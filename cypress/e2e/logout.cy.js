describe('Logout Feature - Comprehensive Minimal Tests', () => {
  const apiBase = 'http://127.0.0.1:8000/api';

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.window().then((win) => {
      win.localStorage.setItem('API_BASE', apiBase);
    });
  });

  const setupUserSession = (userData = {}) => {
    const user = { 
      id: 1, 
      email: 'test@example.com', 
      first_name: 'Test',
      ...userData 
    };
    
    cy.intercept('GET', `${apiBase}/users/profile/`, { statusCode: 200, body: user });
    cy.intercept('GET', `${apiBase}/home/`, { statusCode: 200, body: {} });
    
    cy.window().then((win) => {
      win.localStorage.setItem('access', 'valid-token');
      win.localStorage.setItem('refresh', 'valid-refresh-token');
      win.localStorage.setItem('currentUser', JSON.stringify(user));
    });
  };

  const performLogout = () => {
    cy.window().then((win) => {
      if (win.handleLogout) win.handleLogout();
    });
    cy.on('window:confirm', () => true);
  };

  // ===== 1. BASIC FUNCTIONAL TEST =====
  it('successfully logs out and redirects to login', () => {
    setupUserSession();
    cy.intercept('POST', `${apiBase}/auth/jwt/blacklist/`, { 
      statusCode: 200,
      body: { message: 'Token blacklisted successfully' }
    }).as('blacklist');

    cy.visit('/home/');
    performLogout();

    cy.wait('@blacklist');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('access')).to.be.null;
      expect(win.localStorage.getItem('currentUser')).to.be.null;
    });
    cy.url().should('include', '/login/');
  });

  // ===== 2. NEGATIVE TEST =====
  it('handles missing refresh token gracefully', () => {
    // Setup without refresh token
    const user = { id: 1, email: 'test@example.com' };
    cy.intercept('GET', `${apiBase}/users/profile/`, { statusCode: 200, body: user });
    cy.intercept('GET', `${apiBase}/home/`, { statusCode: 200, body: {} });
    
    cy.window().then((win) => {
      win.localStorage.setItem('access', 'valid-token');
      // Intentionally no refresh token
      win.localStorage.setItem('currentUser', JSON.stringify(user));
    });

    cy.intercept('POST', `${apiBase}/auth/jwt/blacklist/`, { statusCode: 200 });

    cy.visit('/home/');
    performLogout();

    cy.window().then((win) => {
      expect(win.localStorage.getItem('access')).to.be.null;
    });
    cy.url().should('include', '/login/');
  });

  // ===== 3. BOUNDARY & EDGE CASE TEST =====
  it('handles extremely large user data in localStorage', () => {
    const largeUserData = {
      profile: {
        bio: 'A'.repeat(10000), // 10KB of data
        history: Array(1000).fill('activity_entry'),
        preferences: { ...Array(500).fill('pref').reduce((acc, _, i) => ({ ...acc, [`pref${i}`]: 'value' }), {}) }
      }
    };

    setupUserSession(largeUserData);
    cy.intercept('POST', `${apiBase}/auth/jwt/blacklist/`, { statusCode: 200 });

    cy.visit('/home/');
    performLogout();

    cy.window().then((win) => {
      expect(win.localStorage.getItem('currentUser')).to.be.null;
      expect(win.localStorage.getItem('access')).to.be.null;
    });
    cy.url().should('include', '/login/');
  });

  // ===== 4. ERROR STATE TEST =====
  it('handles server errors during logout API call', () => {
    setupUserSession();
    
    // Test multiple error scenarios
    const errorScenarios = [
      { status: 500, body: { error: 'Internal Server Error' } },
      { status: 429, body: { error: 'Too Many Requests' } },
      { forceNetworkError: true }
    ];

    errorScenarios.forEach((errorConfig) => {
      cy.intercept('POST', `${apiBase}/auth/jwt/blacklist/`, errorConfig).as('blacklistError');

      cy.visit('/home/');
      performLogout();

      // Should still clear data and redirect despite API errors
      cy.window().then((win) => {
        expect(win.localStorage.getItem('access')).to.be.null;
        expect(win.localStorage.getItem('currentUser')).to.be.null;
      });
      cy.url().should('include', '/login/');

      // Reset for next scenario
      cy.clearLocalStorage();
      cy.window().then((win) => {
        win.localStorage.setItem('API_BASE', apiBase);
      });
    });
  });

  // ===== 5. SESSION & VALIDATION TEST =====
  it('validates session and redirects unauthorized users', () => {
    // Test 1: No tokens at all
    cy.visit('/home/');
    cy.url().should('include', '/login/');

    // Test 2: Expired tokens (API returns 401)
    cy.intercept('GET', `${apiBase}/users/profile/`, { 
      statusCode: 401,
      body: { detail: 'Token expired' }
    });
    cy.intercept('GET', `${apiBase}/home/`, { 
      statusCode: 401,
      body: { detail: 'Token expired' }
    });

    cy.window().then((win) => {
      win.localStorage.setItem('access', 'expired-token');
      win.localStorage.setItem('refresh', 'expired-refresh');
    });

    cy.visit('/home/');
    cy.url().should('include', '/login/');
  });

  // ===== 6. UI DEFENSIVE TEST =====
    it('handles UI interactions and responsive behavior', () => {
    setupUserSession();
    cy.intercept('POST', `${apiBase}/auth/jwt/blacklist/`, { 
        delay: 1000,
        statusCode: 200 
    }).as('slowBlacklist');

    cy.visit('/home/');

    // Test 1: Multiple rapid clicks on logout button
    cy.get('#moreBtn').click();
    cy.get('#dropdownMenu.show').should('be.visible');
    
    // Rapidly click logout multiple times
    cy.get('#dropdownMenu button.dropdown-item')
        .contains('Log Out')
        .click()
        .click(); // Second click

    cy.on('window:confirm', () => true);

    // Wait for API call(s) - don't assert on count since we're testing real behavior
    cy.wait('@slowBlacklist');

    // Verify logout completed
    cy.window().then((win) => {
        expect(win.localStorage.getItem('access')).to.be.null;
    });
    cy.url().should('include', '/login/');

    // Rest of the test remains the same...
    // Test 2: Cancel logout confirmation
    setupUserSession();
    cy.visit('/home/');
    
    cy.window().then((win) => {
        const originalConfirm = win.confirm;
        win.confirm = () => false;
        
        if (win.handleLogout) win.handleLogout();
        
        win.confirm = originalConfirm;
    });

    cy.url().should('include', '/home/');
    cy.window().its('localStorage.access').should('eq', 'valid-token');

    // Test 3: Mobile viewport
    cy.viewport(375, 667);
    cy.get('#moreBtn').should('be.visible');
    });
});