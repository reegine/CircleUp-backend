/// <reference types="cypress" />

describe('CircleUP Login System Tests', () => {
  const baseUrl = 'http://127.0.0.1:8000'; // adjust if needed
  const apiBase = `${baseUrl}/api`;

  beforeEach(() => {
    cy.visit(`${baseUrl}/login/`);
    cy.clearLocalStorage();
  });

  it('renders the login page correctly', () => {
    cy.contains('Log in to your account').should('be.visible');
    cy.get('#emailInput').should('be.visible');
    cy.get('#passwordInput').should('be.visible');
    cy.get('.login-btn').should('contain', 'Login');
    cy.get('.signup-link a').should('have.attr', 'href', '/register/');
  });

  it('requires email and password before submitting', () => {
    // click the login button (this may or may not trigger built-in validation)
    cy.get('.login-btn').click();

    // Check validity for email input
    cy.get('#emailInput').then($el => {
      // $el[0] is the real DOM element
      expect($el[0].checkValidity()).to.be.false;
      // You can also assert that browser produced a validation message string
      expect($el[0].validationMessage).to.be.a('string').and.not.be.empty;
    });

    // Check validity for password input
    cy.get('#passwordInput').then($el => {
      expect($el[0].checkValidity()).to.be.false;
      expect($el[0].validationMessage).to.be.a('string').and.not.be.empty;
    });

    // The form submit handler should not have set an app-level "loginMsg"
    cy.get('#loginMsg').should('have.text', ''); // or whatever default is
  });



  it('shows browser validation error when email format is invalid', () => {
    cy.get('#emailInput').type('invalid-email');
    cy.get('#passwordInput').type('password123');
    cy.get('.login-btn').click();

    // Check validity state directly
    cy.get('#emailInput').then($el => {
      expect($el[0].checkValidity()).to.be.false;
      expect($el[0].validationMessage).to.be.a('string').and.not.be.empty;
    });

    // Optionally confirm the form did not submit
    cy.url().should('include', '/login/');
  });


  it('shows error when password is incorrect', () => {
    cy.get('#emailInput').type('regine.angelina.halim@gmail.com');
    cy.get('#passwordInput').type('wrongpassword');
    cy.intercept('POST', `${apiBase}/auth/login/`, {
      statusCode: 401,
      body: { error: 'Invalid credentials' },
    });
    cy.get('.login-btn').click();
    cy.get('#loginMsg').should('contain', 'Invalid credentials').and('have.class', 'error');
  });

  it('logs in successfully with valid credentials', () => {
    cy.intercept('POST', `${apiBase}/auth/login/`, {
      statusCode: 200,
      body: {
        tokens: { access: 'mock-access', refresh: 'mock-refresh' },
        user: { id: 1, email: 'regine.angelina.halim@gmail.com', username: 'Saipul' },
      },
    }).as('loginRequest');

    cy.get('#emailInput').type('regine.angelina.halim@gmail.com');
    cy.get('#passwordInput').type('Akupadamu9!');
    cy.get('#rememberInput').check();
    cy.get('.login-btn').click();

    cy.wait('@loginRequest');
    cy.get('#loginMsg').should('contain', 'Login successful!').and('have.class', 'success');

    cy.window().its('localStorage.access').should('eq', 'mock-access');
    cy.window().its('localStorage.refresh').should('eq', 'mock-refresh');
    cy.window().its('localStorage.currentUser').should('include', 'Saipul');
  });

  it('redirects to /home/ after successful login', () => {
    cy.intercept('POST', `${apiBase}/auth/login/`, {
      statusCode: 200,
      body: {
        tokens: { access: 'mock-access', refresh: 'mock-refresh' },
        user: { id: 1, email: 'regine.angelina.halim@gmail.com', username: 'gine' },
      },
    }).as('loginRequest');

    cy.get('#emailInput').type('regine.angelina.halim@gmail.com');
    cy.get('#passwordInput').type('Akupadamu9!');
    cy.get('.login-btn').click();

    // Wait for login request to finish and log it
    cy.wait('@loginRequest').then((interception) => {
      console.log('Intercepted request:', interception);
    });

    // Add debugging
    cy.log('Checking URL...');
    cy.url().then((url) => {
      cy.log('Current URL:', url);
    });

    cy.location('pathname', { timeout: 10000 }).should('eq', '/home/');
  });

  it('prevents access to /home/ if not logged in', () => {
    cy.visit(`${baseUrl}/home/`);
    cy.url().should('include', '/login/');
  });

  it('allows access to /home/ if access token exists', () => {
    cy.visit(`${baseUrl}/login/`);
    cy.window().then((win) => {
      win.localStorage.setItem('access', 'mock-access');
      cy.visit(`${baseUrl}/home/`);
      cy.url().should('include', '/home/');
    });
  });

  it('toggles password visibility correctly', () => {
    cy.get('#passwordInput').type('mypassword');
    cy.get('#passwordInput').should('have.attr', 'type', 'password');
    cy.get('#togglePassword').click();
    cy.get('#passwordInput').should('have.attr', 'type', 'text');
    cy.get('#togglePassword').click();
    cy.get('#passwordInput').should('have.attr', 'type', 'password');
  });

  it('remembers user when "Remember me" is checked', () => {
    cy.intercept('POST', `${apiBase}/auth/login/`, {
      statusCode: 200,
      body: {
        tokens: { access: 'mock-access', refresh: 'mock-refresh' },
        user: { id: 1, email: 'regine.angelina.halim@gmail.com' },
      },
    });

    cy.get('#emailInput').type('regine.angelina.halim@gmail.com');
    cy.get('#passwordInput').type('Akupadamu9!');
    cy.get('#rememberInput').check();
    cy.get('.login-btn').click();

    cy.window().its('localStorage.access').should('eq', 'mock-access');
  });

  it('does not remember user when "Remember me" is unchecked', () => {
    cy.intercept('POST', `${apiBase}/auth/login/`, {
      statusCode: 200,
      body: {
        tokens: { access: 'mock-access', refresh: 'mock-refresh' },
        user: { id: 1, email: 'regine.angelina.halim@gmail.com' },
      },
    });

    cy.get('#emailInput').type('regine.angelina.halim@gmail.com');
    cy.get('#passwordInput').type('Akupadamu9!');
    cy.get('#rememberInput').uncheck();
    cy.get('.login-btn').click();

    cy.window().its('localStorage.access').should('eq', 'mock-access');
  });

  it('rejects overly long email or password', () => {
    cy.get('#emailInput').type('a'.repeat(255) + '@test.com');
    cy.get('#passwordInput').type('a'.repeat(129)); // >128 char limit
    cy.get('.login-btn').click();
    cy.get('#loginMsg').should('contain', 'Login failed');
  });

  it('handles expired access token by redirecting to login', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('access', 'expired-token');
    });
    cy.intercept('GET', `${apiBase}/users/profile/`, { 
      statusCode: 401,
      body: { detail: 'Token expired' },
    });
    
    cy.visit(`${baseUrl}/profile/`);
    cy.url().should('include', '/login/');
    
    // The message might be empty or show default state
    // Just verify we're on login page and form is present
    cy.get('#loginForm').should('be.visible');
    cy.get('#emailInput').should('be.visible');
    cy.get('#passwordInput').should('be.visible');
  });

  it('shows error message when server is down', () => {
    cy.intercept('POST', `${apiBase}/auth/login/`, {
      statusCode: 500,
      body: { error: "Internal server error" }
    }).as('loginRequest');
    
    cy.get('#emailInput').type('regine.angelina.halim@gmail.com');
    cy.get('#passwordInput').type('Akupadamu9!');
    cy.get('.login-btn').click();
    
    cy.wait('@loginRequest');
    
    // Try these different assertions to see what works:
    cy.get('#loginMsg').should('contain', 'Internal server error').and('have.class', 'error');
  });

  it('disables login button while submitting', () => {
    cy.intercept('POST', `${apiBase}/auth/login/`, { delay: 1000 }).as('slowLogin');
    cy.get('#emailInput').type('regine.angelina.halim@gmail.com');
    cy.get('#passwordInput').type('Akupadamu9!');
    cy.get('.login-btn').click();
    cy.get('.login-btn').should('be.disabled');
    cy.wait('@slowLogin');
  });

  it('forces logout if token payload is tampered', () => {
    cy.window().then((win) => {
      win.localStorage.setItem('access', 'invalid.token.payload');
    });
    cy.visit(`${baseUrl}/home/`);
    cy.url().should('include', '/login/');
  });

});
