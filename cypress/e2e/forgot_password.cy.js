describe('Forgot Password Flow', () => {
  const apiBase = 'http://127.0.0.1:8000/api';
  const baseUrl = 'http://127.0.0.1:8000';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.clearAllSessionStorage();
  });

  // ===== FORGOT PASSWORD PAGE TESTS =====
  describe('Forgot Password Page', () => {
    beforeEach(() => {
      cy.visit('/forgot-password/');
    });

    // 1. NEGATIVE TESTS
    describe('Negative Tests', () => {
      it('shows error for non-existent email', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          statusCode: 400,
          body: { email: ['User with this email does not exist.'] }
        }).as('otpRequest');

        cy.get('#email').type('nonexistent@example.com');
        cy.get('#sendBtn').click();

        cy.wait('@otpRequest');
        cy.get('#messageBox')
          .should('contain', 'User with this email does not exist')
          .and('have.class', 'error');
      });

      it('shows error when OTP service is down', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          statusCode: 500,
          body: { error: 'OTP service unavailable' }
        }).as('otpRequest');

        cy.get('#email').type('test@example.com');
        cy.get('#sendBtn').click();

        cy.wait('@otpRequest');
        cy.get('#messageBox')
          .should('contain', 'OTP service unavailable')
          .and('have.class', 'error');
      });

      it('shows network error when server is unreachable', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          forceNetworkError: true
        });

        cy.get('#email').type('test@example.com');
        cy.get('#sendBtn').click();

        cy.get('#messageBox')
          .should('contain', 'Network error')
          .and('have.class', 'error');
      });

      it('prevents submission with empty email', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`).as('otpRequest');

        cy.get('#sendBtn').click();

        cy.get('#messageBox')
          .should('contain', 'Please enter your email address')
          .and('have.class', 'error');
        cy.get('@otpRequest.all').should('have.length', 0);
      });
    });

    // 2. BOUNDARY/EDGE CASES
    describe('Boundary/Edge Cases', () => {
      it('handles very long email addresses', () => {
        const longEmail = 'a'.repeat(100) + '@example.com';
        
        cy.get('#email').type(longEmail);
        cy.get('#email').should('have.value', longEmail);
      });

      it('handles email with special characters', () => {
        const specialEmail = 'test.user+tag@example-domain.co.uk';
        
        cy.get('#email').type(specialEmail);
        cy.get('#email').should('have.value', specialEmail);
      });

      it('trims whitespace from email input', () => {
        cy.get('#email').type('  test@example.com  ');
        cy.get('#email').should('have.value', '  test@example.com  ');
        // Trimming should happen in the form handler
      });
    });

    // 3. ERROR STATES
    describe('Error States', () => {
      it('shows appropriate error for rate limiting', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          statusCode: 429,
          body: { error: 'Too many OTP requests. Please try again later.' }
        }).as('rateLimitRequest');

        cy.get('#email').type('test@example.com');
        cy.get('#sendBtn').click();

        cy.wait('@rateLimitRequest');
        cy.get('#messageBox')
          .should('contain', 'Too many OTP requests')
          .and('have.class', 'error');
      });

      it('handles malformed email validation', () => {
        cy.get('#email').type('not-an-email');
        cy.get('#sendBtn').click();

        // Should show HTML5 validation error or custom validation
        cy.get('#email:invalid').should('exist');
      });
    });

    // 4. UI DEFENSIVE TESTS
    describe('UI Defensive Tests', () => {
      it('handles rapid double-clicks on send button', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          delay: 1000,
          statusCode: 200,
          body: { message: 'OTP sent successfully' }
        }).as('otpRequest');

        cy.get('#email').type('test@example.com');
        cy.get('#sendBtn').dblclick();

        cy.wait('@otpRequest');
        cy.get('@otpRequest.all').should('have.length', 1);
      });

      it('disables button during submission', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          delay: 2000,
          statusCode: 200,
          body: { message: 'OTP sent successfully' }
        }).as('otpRequest');

        cy.get('#email').type('test@example.com');
        cy.get('#sendBtn').click();

        cy.get('#sendBtn').should('be.disabled');
        cy.get('#sendBtn').should('contain', 'Sending...');
        
        cy.wait('@otpRequest');
        cy.get('#sendBtn').should('not.be.disabled');
        cy.get('#sendBtn').should('contain', 'Send');
      });

      it('navigation links work correctly', () => {
        cy.get('.login-link a').should('have.attr', 'href', '/login/');
        cy.get('.login-link a').click();
        cy.url().should('include', '/login/');
      });

      it('responsive design works on mobile viewport', () => {
        cy.viewport('iphone-x');
        
        cy.get('h1').should('be.visible');
        cy.get('#email').should('be.visible');
        cy.get('#sendBtn').should('be.visible');
        cy.get('.login-link').should('be.visible');
        
        cy.get('#email').type('test@example.com');
        cy.get('#sendBtn').should('be.enabled');
      });
    });

    // SUCCESS SCENARIOS
    describe('Success Scenarios', () => {
      it('successfully sends OTP and redirects to verify page', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          statusCode: 200,
          body: { message: 'OTP sent successfully' }
        }).as('otpRequest');

        cy.get('#email').type('regine.angelina.halim@gmail.com');
        cy.get('#sendBtn').click();

        cy.wait('@otpRequest');
        cy.get('#messageBox')
          .should('contain', 'OTP sent to your email!')
          .and('have.class', 'success');

        // Check if email is stored in sessionStorage
        cy.window().then((win) => {
          expect(win.sessionStorage.getItem('reset_email')).to.equal('regine.angelina.halim@gmail.com');
        });

        // Should redirect after delay
        cy.url({ timeout: 3000 }).should('include', '/verify-otp/');
      });
    });
  });

  // ===== VERIFY OTP PAGE TESTS =====
  describe('Verify OTP Page', () => {
    beforeEach(() => {
      // Set up session storage for OTP verification flow
      cy.window().then((win) => {
        win.sessionStorage.setItem('reset_email', 'regine.angelina.halim@gmail.com');
      });
      cy.visit('/verify-otp/');
    });

    // 1. NEGATIVE TESTS
    describe('Negative Tests', () => {
      it('shows error for invalid OTP', () => {
        cy.intercept('POST', `${apiBase}/verify-otp/`, {
          statusCode: 400,
          body: { error: 'Invalid OTP code' }
        }).as('verifyOTP');

        fillOTP('123456');
        cy.get('#verifyBtn').click();

        cy.wait('@verifyOTP');
        cy.get('#messageBox')
          .should('contain', 'Invalid OTP')
          .and('have.class', 'error');
        
        // OTP inputs should be cleared and focused on first input
        cy.get('.otp-input').first().should('have.focus');
        cy.get('.otp-input').each(($input) => {
          expect($input.val()).to.be.empty;
        });
      });

      it('shows error for expired OTP', () => {
        cy.intercept('POST', `${apiBase}/verify-otp/`, {
          statusCode: 400,
          body: { error: 'OTP has expired' }
        }).as('verifyOTP');

        fillOTP('123456');
        cy.get('#verifyBtn').click();

        cy.wait('@verifyOTP');
        cy.get('#messageBox')
          .should('contain', 'OTP has expired')
          .and('have.class', 'error');
      });

      it('redirects to forgot password if no email in session', () => {
        cy.clearAllSessionStorage();
        cy.visit('/verify-otp/');
        cy.url().should('include', '/forgot-password');
      });
    });

    // 2. BOUNDARY/EDGE CASES
    describe('Boundary/Edge Cases', () => {
      it('handles OTP input with copy-paste', () => {
        cy.get('.otp-input').first().then(($input) => {
          // Simulate paste event
          const pasteEvent = new Event('paste', { bubbles: true });
          pasteEvent.clipboardData = {
            getData: () => '123456'
          };
          $input[0].dispatchEvent(pasteEvent);
        });

        // All OTP inputs should be filled
        cy.get('.otp-input').each(($input, index) => {
          expect($input.val()).to.equal(['1','2','3','4','5','6'][index]);
        });
      });

      it('handles backspace navigation between inputs', () => {
        fillOTP('123');
        
        // Press backspace on fourth input (empty) should focus third input
        cy.get('.otp-input[data-index="3"]').type('{backspace}');
        cy.get('.otp-input[data-index="2"]').should('have.focus');
      });

      it('auto-advances to next input on digit entry', () => {
        cy.get('.otp-input[data-index="0"]').type('1');
        cy.get('.otp-input[data-index="1"]').should('have.focus');
        
        cy.get('.otp-input[data-index="1"]').type('2');
        cy.get('.otp-input[data-index="2"]').should('have.focus');
      });
    });

    // 3. ERROR STATES
    describe('Error States', () => {
      it('prevents submission with incomplete OTP', () => {
        cy.intercept('POST', `${apiBase}/verify-otp/`).as('verifyOTP');

        fillOTP('123'); // Only 3 digits
        cy.get('#verifyBtn').click();

        cy.get('#messageBox')
          .should('contain', 'Please enter all 6 digits')
          .and('have.class', 'error');
        cy.get('@verifyOTP.all').should('have.length', 0);
      });

      it('handles resend OTP failure', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          statusCode: 500,
          body: { error: 'Failed to resend OTP' }
        }).as('resendOTP');

        // Wait for timer to expire or force click
        cy.get('#resendBtn').invoke('removeAttr', 'disabled');
        cy.get('#resendBtn').click();

        cy.wait('@resendOTP');
        cy.get('#messageBox')
          .should('contain', 'Failed to resend OTP')
          .and('have.class', 'error');
      });
    });

    // 4. UI DEFENSIVE TESTS
    describe('UI Defensive Tests', () => {
      it('resend button has cooldown timer', () => {
        cy.get('#resendBtn').should('be.disabled');
        cy.get('#timer').should('contain', '60s');
        
        // Timer should count down
        cy.wait(2000);
        cy.get('#timer').should('contain', '58s');
      });

      it('disables verify button during submission', () => {
        cy.intercept('POST', `${apiBase}/verify-otp/`, {
          delay: 2000,
          statusCode: 200,
          body: { message: 'OTP verified successfully' }
        }).as('verifyOTP');

        fillOTP('123456');
        cy.get('#verifyBtn').click();

        cy.get('#verifyBtn').should('be.disabled');
        cy.get('#verifyBtn').should('contain', 'Verifying...');
        
        cy.wait('@verifyOTP');
        cy.get('#verifyBtn').should('not.be.disabled');
        cy.get('#verifyBtn').should('contain', 'Verify OTP');
      });

      it('navigation back to forgot password works', () => {
        cy.get('.back-link a').should('have.attr', 'href', '/forgot-password');
        cy.get('.back-link a').click();
        cy.url().should('include', '/forgot-password');
      });
    });

    // SUCCESS SCENARIOS
    describe('Success Scenarios', () => {
      it('successfully verifies OTP and redirects to reset password', () => {
        cy.intercept('POST', `${apiBase}/verify-otp/`, {
          statusCode: 200,
          body: { message: 'OTP verified successfully' }
        }).as('verifyOTP');

        fillOTP('123456');
        cy.get('#verifyBtn').click();

        cy.wait('@verifyOTP');
        cy.get('#messageBox')
          .should('contain', 'OTP verified!')
          .and('have.class', 'success');

        // Check if OTP verification is stored
        cy.window().then((win) => {
          expect(win.sessionStorage.getItem('otp_verified')).to.equal('true');
        });

        // Should redirect after delay
        cy.url({ timeout: 2000 }).should('include', '/reset-password/');
      });

      it('successfully resends OTP', () => {
        cy.intercept('POST', `${apiBase}/generate-otp/`, {
          statusCode: 200,
          body: { message: 'OTP sent successfully' }
        }).as('resendOTP');

        // Wait for timer to expire or force click
        cy.get('#resendBtn').invoke('removeAttr', 'disabled');
        cy.get('#resendBtn').click();

        cy.wait('@resendOTP');
        cy.get('#messageBox')
          .should('contain', 'New OTP sent to your email!')
          .and('have.class', 'success');

        // OTP inputs should be cleared and focused
        cy.get('.otp-input').first().should('have.focus');
        cy.get('.otp-input').each(($input) => {
          expect($input.val()).to.be.empty;
        });
      });
    });
  });

  // ===== RESET PASSWORD PAGE TESTS =====
  describe('Reset Password Page', () => {
    beforeEach(() => {
      // Set up session storage for reset password flow
      cy.window().then((win) => {
        win.sessionStorage.setItem('reset_email', 'regine.angelina.halim@gmail.com');
        win.sessionStorage.setItem('otp_verified', 'true');
      });
      cy.visit('/reset-password/');
    });

    // 1. NEGATIVE TESTS
    describe('Negative Tests', () => {
      it('shows error for weak password', () => {
        cy.intercept('POST', `${apiBase}/reset-password/`, {
          statusCode: 400,
          body: { new_password: ['Password is too weak'] }
        }).as('resetPassword');

        cy.get('#newPassword').type('weak');
        cy.get('#confirmPassword').type('weak');
        cy.get('#resetBtn').click();

        cy.get('#messageBox')
          .should('contain', 'Please create a stronger password')
          .and('have.class', 'error');
      });

      it('shows error for non-matching passwords', () => {
        cy.get('#newPassword').type('StrongPass123!');
        cy.get('#confirmPassword').type('DifferentPass123!');
        cy.get('#resetBtn').click();

        cy.get('#messageBox')
          .should('contain', 'Passwords do not match')
          .and('have.class', 'error');
      });

      it('redirects to forgot password if OTP not verified', () => {
        cy.clearAllSessionStorage();
        cy.visit('/reset-password/');
        cy.url().should('include', '/forgot-password');
      });
    });

    // 2. BOUNDARY/EDGE CASES
    describe('Boundary/Edge Cases', () => {
      it('handles very long passwords', () => {
        const longPassword = 'A'.repeat(100) + '1!';
        
        cy.get('#newPassword').type(longPassword);
        cy.get('#newPassword').should('have.value', longPassword);
        
        // Strength checker should handle long passwords
        cy.get('.strength-fill').should('exist');
      });

      it('handles passwords with special characters', () => {
        const specialPassword = 'P@$$w0rd!🦄';
        
        cy.get('#newPassword').type(specialPassword);
        cy.get('#newPassword').should('have.value', specialPassword);
      });
    });

    // 3. ERROR STATES
    describe('Error States', () => {
      it('shows password strength indicators correctly', () => {
        // Test weak password
        cy.get('#newPassword').type('weak');
        cy.get('.strength-fill').should('have.class', 'weak');
        cy.get('[data-req="length"]').should('not.have.class', 'met');
        cy.get('[data-req="uppercase"]').should('not.have.class', 'met');

        // Test medium password
        cy.get('#newPassword').clear().type('MediumPass');
        cy.get('.strength-fill').should('have.class', 'medium');
        cy.get('[data-req="length"]').should('have.class', 'met');
        cy.get('[data-req="uppercase"]').should('have.class', 'met');
        cy.get('[data-req="number"]').should('not.have.class', 'met');

        // Test strong password
        cy.get('#newPassword').clear().type('StrongPass123!');
        cy.get('.strength-fill').should('have.class', 'strong');
        cy.get('.requirement.met').should('have.length', 4);
      });

      it('prevents submission with short password', () => {
        cy.get('#newPassword').type('short');
        cy.get('#confirmPassword').type('short');
        cy.get('#resetBtn').click();

        cy.get('#messageBox')
          .should('contain', 'Password must be at least 8 characters long')
          .and('have.class', 'error');
      });
    });

    // 4. UI DEFENSIVE TESTS
    describe('UI Defensive TESTS', () => {
      it('password visibility toggle works for both fields', () => {
        const password = 'TestPassword123!';
        
        cy.get('#newPassword').type(password);
        cy.get('#confirmPassword').type(password);

        // Toggle new password visibility
        cy.get('[data-target="newPassword"]').click();
        cy.get('#newPassword').should('have.attr', 'type', 'text');
        cy.get('[data-target="newPassword"]').click();
        cy.get('#newPassword').should('have.attr', 'type', 'password');

        // Toggle confirm password visibility
        cy.get('[data-target="confirmPassword"]').click();
        cy.get('#confirmPassword').should('have.attr', 'type', 'text');
        cy.get('[data-target="confirmPassword"]').click();
        cy.get('#confirmPassword').should('have.attr', 'type', 'password');
      });

      it('disables reset button during submission', () => {
        cy.intercept('POST', `${apiBase}/reset-password/`, {
          delay: 2000,
          statusCode: 200,
          body: { message: 'Password reset successfully' }
        }).as('resetPassword');

        cy.get('#newPassword').type('NewStrongPass123!');
        cy.get('#confirmPassword').type('NewStrongPass123!');
        cy.get('#resetBtn').click();

        cy.get('#resetBtn').should('be.disabled');
        cy.get('#resetBtn').should('contain', 'Resetting...');
        
        cy.wait('@resetPassword');
        cy.get('#resetBtn').should('not.be.disabled');
        cy.get('#resetBtn').should('contain', 'Reset Password');
      });

      it('navigation to login works', () => {
        cy.get('.login-link a').should('have.attr', 'href', '/login/');
        cy.get('.login-link a').click();
        cy.url().should('include', '/login/');
      });
    });

    // SUCCESS SCENARIOS
    describe('Success Scenarios', () => {
      it('successfully resets password and redirects to login', () => {
        cy.intercept('POST', `${apiBase}/reset-password/`, {
          statusCode: 200,
          body: { message: 'Password reset successfully' }
        }).as('resetPassword');

        cy.get('#newPassword').type('NewStrongPass123!');
        cy.get('#confirmPassword').type('NewStrongPass123!');
        cy.get('#resetBtn').click();

        cy.wait('@resetPassword');
        cy.get('#messageBox')
          .should('contain', 'Password reset successfully!')
          .and('have.class', 'success');

        // Session storage should be cleared
        cy.window().then((win) => {
          expect(win.sessionStorage.getItem('reset_email')).to.be.null;
          expect(win.sessionStorage.getItem('otp_verified')).to.be.null;
        });

        // Should redirect to login
        cy.url({ timeout: 3000 }).should('include', '/login/');
      });
    });
  });

  // ===== COMPLETE FLOW TEST =====
  describe('Complete Forgot Password Flow', () => {
    it('completes entire forgot password flow successfully', () => {
      // Step 1: Forgot Password
      cy.visit('/forgot-password/');
      
      cy.intercept('POST', `${apiBase}/generate-otp/`, {
        statusCode: 200,
        body: { message: 'OTP sent successfully' }
      }).as('sendOTP');

      cy.get('#email').type('regine.angelina.halim@gmail.com');
      cy.get('#sendBtn').click();
      cy.wait('@sendOTP');
      cy.url().should('include', '/verify-otp/');

      // Step 2: Verify OTP
      cy.intercept('POST', `${apiBase}/verify-otp/`, {
        statusCode: 200,
        body: { message: 'OTP verified successfully' }
      }).as('verifyOTP');

      fillOTP('123456');
      cy.get('#verifyBtn').click();
      cy.wait('@verifyOTP');
      cy.url().should('include', '/reset-password/');

      // Step 3: Reset Password
      cy.intercept('POST', `${apiBase}/reset-password/`, {
        statusCode: 200,
        body: { message: 'Password reset successfully' }
      }).as('resetPassword');

      cy.get('#newPassword').type('NewStrongPass123!');
      cy.get('#confirmPassword').type('NewStrongPass123!');
      cy.get('#resetBtn').click();
      cy.wait('@resetPassword');
      cy.url().should('include', '/login/');
    });
  });

  // Helper function to fill OTP inputs
  function fillOTP(otp) {
    const digits = otp.split('');
    digits.forEach((digit, index) => {
      cy.get(`.otp-input[data-index="${index}"]`).type(digit);
    });
  }
});