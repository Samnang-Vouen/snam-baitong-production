/**
 * Authentication Service
 * 
 * This service handles all authentication-related API calls.
 * Currently uses mock logic for development.
 * Ready for backend integration - just update the implementation.
 */

import { login as loginApi } from './api';

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Login user with username/email and password
 * 
 * FOR PRODUCTION: This will call the real backend API
 * FOR DEVELOPMENT: Uses mock logic for testing UI
 * 
 * @param {string} usernameOrEmail - Username or email
 * @param {string} password - User password
 * @param {boolean} rememberMe - Whether to remember user
 * @returns {Promise<Object>} - User data and token
 */
export const authenticateUser = async (usernameOrEmail, password, rememberMe = false) => {
  try {
    // When backend is ready, uncomment this:
    const response = await loginApi(usernameOrEmail, password);
    
    // Store token in localStorage as backup for cookie-based auth
    if (response.token) {
      localStorage.setItem('authToken', response.token);
    }
    
    // Handle remember me preference
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
      localStorage.setItem('savedUsername', usernameOrEmail);
    } else {
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('savedUsername');
    }
    
    return response;
  } catch (error) {
    // Handle different error types
    if (error.response) {
      // Backend returned an error response
      throw new Error(error.response.data?.error || 'Login failed');
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('Unable to connect to server. Please try again.');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
};

/**
 * Get saved login credentials (if remember me was checked)
 * @returns {Object} - Saved username and remember me status
 */
export const getSavedCredentials = () => {
  const rememberMe = localStorage.getItem('rememberMe') === 'true';
  const savedUsername = localStorage.getItem('savedUsername') || '';
  return { rememberMe, savedUsername };
};

/**
 * Clear saved credentials
 */
export const clearSavedCredentials = () => {
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('savedUsername');
  localStorage.removeItem('authToken');
};
