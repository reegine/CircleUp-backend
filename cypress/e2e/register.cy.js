describe('Register Page', () => {
  const apiBase = 'http://127.0.0.1:8000/api';
  const baseUrl = 'http://127.0.0.1:8000';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.visit('/register/');
  });

  // ===== 1. NEGATIVE TESTS =====
  describe('Negative Tests - Invalid inputs and server errors', () => {
    it('shows error for duplicate email registration', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 400,
        body: { email: ['User with this email already exists.'] }
      }).as('registerRequest');

      fillValidRegistrationForm();
      cy.get('.register-btn').click();

      cy.wait('@registerRequest');
      cy.get('#registerMsg')
        .should('contain', 'User with this email already exists')
        .and('have.class', 'error');
    });

    it('shows error for duplicate username', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 400,
        body: { username: ['This username is already taken.'] }
      }).as('registerRequest');

      fillValidRegistrationForm();
      cy.get('.register-btn').click();

      cy.wait('@registerRequest');
      cy.get('#registerMsg')
        .should('contain', 'This username is already taken')
        .and('have.class', 'error');
    });

    it('shows error for weak password from server', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 400,
        body: { password: ['Password must contain at least 8 characters with numbers and symbols.'] }
      }).as('registerRequest');

      fillValidRegistrationForm();
      cy.get('.register-btn').click();

      cy.wait('@registerRequest');
      cy.get('#registerMsg')
        .should('contain', 'Password must contain')
        .and('have.class', 'error');
    });

    it('shows error when server is down', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 500,
        body: { detail: 'Internal server error' }
      }).as('registerRequest');

      fillValidRegistrationForm();
      cy.get('.register-btn').click();

      cy.wait('@registerRequest');
      cy.get('#registerMsg')
        .should('contain', 'Internal server error')
        .and('have.class', 'error');
    });

    it('shows network error when server is unreachable', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        forceNetworkError: true
      });

      fillValidRegistrationForm();
      cy.get('.register-btn').click();

      cy.get('#registerMsg')
        .should('contain', 'Registration failed')
        .and('have.class', 'error');
    });
  });

  // ===== 2. BOUNDARY/EDGE CASES =====
  describe('Boundary/Edge Cases', () => {
    it('handles very long names appropriately', () => {
      const longName = 'A'.repeat(100);
      
      cy.get('#firstName').type(longName);
      cy.get('#lastName').type(longName);
      cy.get('#email').type('test@example.com');
      cy.get('#passwordInput').type('ValidPass123!');
      
      // Should not break the UI
      cy.get('#firstName').should('have.value', longName);
      cy.get('#lastName').should('have.value', longName);
    });

    it('handles email without username - generates from email', () => {
      cy.get('#email').type('testuser@example.com');
      cy.get('#username').should('have.value', '');
      
      // Username should remain empty until form submission
      // The generation happens in the submit handler
    });

    it('handles special characters in names', () => {
      cy.get('#firstName').type("John O'Neil-Smith");
      cy.get('#lastName').type('Déjà vu');
      cy.get('#email').type('test@example.com');
      
      cy.get('#firstName').should('have.value', "John O'Neil-Smith");
      cy.get('#lastName').should('have.value', 'Déjà vu');
    });

    it('handles minimum viable registration data', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 201,
        body: {
          tokens: { access: 'mock-access', refresh: 'mock-refresh' },
          user: { id: 1, email: 'min@test.com', username: 'min' }
        }
      }).as('minimalRegister');

      cy.get('#firstName').type('Min');
      cy.get('#lastName').type('User');
      cy.get('#email').type('min@test.com');
      cy.get('#passwordInput').type('Short1!');
      cy.get('#tos').check();

      cy.get('.register-btn').click();
      cy.wait('@minimalRegister');
    });
  });

  // ===== 3. ERROR STATES =====
  describe('Error States and Validation', () => {
    it('prevents submission without required fields', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`).as('registerRequest');
      
      // Try to submit with empty form
      cy.get('.register-btn').click();
      
      // Should show HTML5 validation errors
      cy.get('#firstName:invalid').should('exist');
      cy.get('#email:invalid').should('exist');
      cy.get('#passwordInput:invalid').should('exist');
      
      // API should not be called
      cy.get('@registerRequest.all').should('have.length', 0);
    });

    it('requires terms and conditions acceptance', () => {
      fillValidRegistrationForm();
      cy.get('#tos').uncheck();
      
      cy.get('.register-btn').click();
      
      // Should show HTML5 validation error
      cy.get('#tos:invalid').should('exist');
    });

    it('handles malformed email validation', () => {
      cy.get('#email').type('not-an-email');
      cy.get('#firstName').type('Test');
      cy.get('#lastName').type('User');
      cy.get('#passwordInput').type('ValidPass123!');
      cy.get('#tos').check();
      
      cy.get('.register-btn').click();
      
      // Should show HTML5 email validation error
      cy.get('#email:invalid').should('exist');
    });

    it('shows appropriate error for various HTTP status codes', () => {
      // Test 403 Forbidden
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 403,
        body: { detail: 'Registration forbidden' }
      }).as('forbiddenRequest');

      fillValidRegistrationForm();
      cy.get('.register-btn').click();
      cy.wait('@forbiddenRequest');
      cy.get('#registerMsg').should('contain', 'Registration forbidden');

      // Test 429 Too Many Requests
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 429,
        body: { detail: 'Too many registration attempts' }
      }).as('rateLimitRequest');

      fillValidRegistrationForm();
      cy.get('.register-btn').click();
      cy.wait('@rateLimitRequest');
      cy.get('#registerMsg').should('contain', 'Too many registration attempts');
    });
  });

  // ===== 4. EXPIRED TOKEN/SESSION =====
  describe('Session and Token Handling', () => {
    it('redirects to home if already logged in', () => {
      cy.window().then((win) => {
        win.localStorage.setItem('access', 'valid-token');
      });

      cy.visit('/register/');
      cy.url().should('include', '/home/');
    });

    it('clears any existing tokens on successful registration', () => {
      // Set some old tokens
      cy.window().then((win) => {
        win.localStorage.setItem('access', 'old-token');
        win.localStorage.setItem('refresh', 'old-refresh');
      });

      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 201,
        body: {
          tokens: { access: 'new-access', refresh: 'new-refresh' },
          user: { id: 2, email: 'new@test.com', username: 'newuser' }
        }
      }).as('registerRequest');

      fillValidRegistrationForm();
      cy.get('.register-btn').click();

      cy.wait('@registerRequest').then(() => {
        cy.window().its('localStorage.access').should('eq', 'new-access');
        cy.window().its('localStorage.refresh').should('eq', 'new-refresh');
      });
    });
  });

  // ===== 5. UI DEFENSIVE TESTS =====
  describe('UI Defensive Tests', () => {
    it('handles rapid double-clicks on register button', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        delay: 1000,
        statusCode: 201,
        body: {
          tokens: { access: 'mock-access', refresh: 'mock-refresh' },
          user: { id: 1, email: 'test@example.com', username: 'testuser' }
        }
      }).as('registerRequest');

      fillValidRegistrationForm();
      
      // Double click rapidly
      cy.get('.register-btn').dblclick();
      
      // Should only make one request
      cy.wait('@registerRequest');
      cy.get('@registerRequest.all').should('have.length', 1);
    });

    it('maintains form data after failed submission', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 400,
        body: { email: ['Email already exists'] }
      }).as('failedRegister');

      const testData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'Password123!'
      };

      cy.get('#firstName').type(testData.firstName);
      cy.get('#lastName').type(testData.lastName);
      cy.get('#email').type(testData.email);
      cy.get('#username').type(testData.username);
      cy.get('#passwordInput').type(testData.password);
      cy.get('#tos').check();

      cy.get('.register-btn').click();
      cy.wait('@failedRegister');

      // Form data should persist
      cy.get('#firstName').should('have.value', testData.firstName);
      cy.get('#lastName').should('have.value', testData.lastName);
      cy.get('#email').should('have.value', testData.email);
      cy.get('#username').should('have.value', testData.username);
      // Password might be cleared for security
    });

    it('password visibility toggle works correctly', () => {
      const password = 'MySecretPassword123!';
      cy.get('#passwordInput').type(password);
      
      // Initially should be password type
      cy.get('#passwordInput').should('have.attr', 'type', 'password');
      
      // Toggle to show password
      cy.get('#togglePassword').click();
      cy.get('#passwordInput').should('have.attr', 'type', 'text');
      cy.get('#passwordInput').should('have.value', password);
      
      // Toggle back to hide password
      cy.get('#togglePassword').click();
      cy.get('#passwordInput').should('have.attr', 'type', 'password');
      cy.get('#passwordInput').should('have.value', password);
    });

    it('navigation links work correctly', () => {
      cy.get('.login-link a').should('have.attr', 'href', '/login/');
      cy.get('.login-link a').click();
      cy.url().should('include', '/login/');
    });

    it('handles browser back/forward navigation', () => {
      fillValidRegistrationForm();
      
      cy.go('back');
      cy.url().should('not.include', '/register/');
      
      cy.go('forward');
      cy.url().should('include', '/register/');
      
      // Form should be cleared after navigation
      cy.get('#firstName').should('have.value', '');
    });

    it('responsive design works on mobile viewport', () => {
      cy.viewport('iphone-x');
      
      // All form elements should be accessible and usable
      cy.get('#firstName').should('be.visible');
      cy.get('#lastName').should('be.visible');
      cy.get('#email').should('be.visible');
      cy.get('#username').should('be.visible');
      cy.get('#passwordInput').should('be.visible');
      cy.get('#tos').should('be.visible');
      cy.get('.register-btn').should('be.visible');
      
      // Form should still be functional
      fillValidRegistrationForm();
      cy.get('.register-btn').should('be.enabled');
    });
  });

  // ===== SUCCESS SCENARIOS =====
  describe('Success Scenarios', () => {
    it('successfully registers with all fields and redirects', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 201,
        body: {
          tokens: { access: 'mock-access', refresh: 'mock-refresh' },
          user: { 
            id: 1, 
            email: 'regine.angelina.halim@gmail.com', 
            username: 'regine',
            first_name: 'Regine',
            last_name: 'Halim'
          }
        }
      }).as('registerRequest');

      fillValidRegistrationForm();
      cy.get('.register-btn').click();

      cy.wait('@registerRequest');
      cy.get('#registerMsg')
        .should('contain', 'Registration successful!')
        .and('have.class', 'success');

      // Check if tokens are stored
      cy.window().its('localStorage.access').should('eq', 'mock-access');
      cy.window().its('localStorage.refresh').should('eq', 'mock-refresh');
      
      // Should redirect after delay
      cy.url({ timeout: 2000 }).should('eq', `${baseUrl}/`);
    });

    it('auto-generates username from email when username is empty', () => {
      cy.intercept('POST', `${apiBase}/auth/register/`, {
        statusCode: 201,
        body: {
          tokens: { access: 'mock-access', refresh: 'mock-refresh' },
          user: { 
            id: 1, 
            email: 'testuser@example.com', 
            username: 'testuser'  // Should match email prefix
          }
        }
      }).as('registerRequest');

      cy.get('#firstName').type('Test');
      cy.get('#lastName').type('User');
      cy.get('#email').type('testuser@example.com');
      // Don't fill username - let it auto-generate
      cy.get('#passwordInput').type('ValidPassword123!');
      cy.get('#tos').check();

      cy.get('.register-btn').click();
      cy.wait('@registerRequest').then((interception) => {
        // Verify the request sent the generated username
        expect(interception.request.body.username).to.equal('testuser');
      });
    });
  });

  // Helper function to fill valid registration form
  function fillValidRegistrationForm() {
    cy.get('#firstName').type('Regine');
    cy.get('#lastName').type('Halim');
    cy.get('#email').type('regine.angelina.halim@gmail.com');
    cy.get('#username').type('regine');
    cy.get('#passwordInput').type('Akupadamu9!');
    cy.get('#tos').check();
  }
});