/**
 * Authentication Modal Component
 * 
 * Provides login, signup, and password reset functionality
 * with Google and GitHub OAuth integration
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Mail, Lock, User, Github } from 'lucide-react';
import authService from '../../services/AuthService';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
`;

const ModalContainer = styled.div`
  background: linear-gradient(145deg, #1a1a1a 0%, #2a2a2a 100%);
  border-radius: 16px;
  padding: 2rem;
  width: 90%;
  max-width: 400px;
  border: 1px solid #333;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  
  &:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }
`;

const Title = styled.h2`
  margin: 0 0 1.5rem 0;
  color: white;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const InputGroup = styled.div`
  position: relative;
`;

const InputIcon = styled.div`
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  z-index: 1;
`;

const Input = styled.input`
  width: 100%;
  padding: 1rem 1rem 1rem 3rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #333;
  border-radius: 8px;
  color: white;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #00d4ff;
    box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.2);
  }
  
  &::placeholder {
    color: #666;
  }
`;

const Button = styled.button`
  padding: 1rem;
  background: ${props => {
    if (props.$variant === 'google') return '#db4437';
    if (props.$variant === 'github') return '#333';
    return 'linear-gradient(45deg, #00d4ff, #0099cc)';
  }};
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.3);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 1rem 0;
  
  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #333;
  }
  
  span {
    padding: 0 1rem;
    color: #666;
    font-size: 0.8rem;
  }
`;

const LinkButton = styled.button`
  background: none;
  border: none;
  color: #00d4ff;
  cursor: pointer;
  font-size: 0.9rem;
  text-decoration: underline;
  margin: 0.5rem 0;
  
  &:hover {
    color: #33e0ff;
  }
`;

const ErrorMessage = styled.div`
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid #ff6b6b;
  border-radius: 6px;
  padding: 0.75rem;
  color: #ff6b6b;
  font-size: 0.8rem;
  margin-bottom: 1rem;
`;

const SuccessMessage = styled.div`
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid #00ff88;
  border-radius: 6px;
  padding: 0.75rem;
  color: #00ff88;
  font-size: 0.8rem;
  margin-bottom: 1rem;
`;

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login', 'signup', 'reset'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let result;

      if (mode === 'login') {
        result = await authService.signInWithEmail(formData.email, formData.password);
      } else if (mode === 'signup') {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        result = await authService.signUpWithEmail(formData.email, formData.password, formData.displayName);
      } else if (mode === 'reset') {
        result = await authService.resetPassword(formData.email);
      }

      if (result.success) {
        setSuccess(result.message);
        if (mode === 'login' || mode === 'signup') {
          setTimeout(() => {
            onSuccess && onSuccess(result.user);
            onClose();
          }, 1000);
        } else {
          // Password reset - show success message
          setTimeout(() => setMode('login'), 2000);
        }
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await authService.signInWithGoogle();
      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => {
          onSuccess && onSuccess(result.user);
          onClose();
        }, 1000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await authService.signInWithGithub();
      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => {
          onSuccess && onSuccess(result.user);
          onClose();
        }, 1000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('GitHub sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'reset': return 'Reset Password';
      default: return 'Sign In';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Please wait...';
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'reset': return 'Send Reset Email';
      default: return 'Sign In';
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose}>
          <X size={20} />
        </CloseButton>

        <Title>{getTitle()}</Title>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}

        <Form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <InputGroup>
              <InputIcon>
                <User size={16} />
              </InputIcon>
              <Input
                type="text"
                name="displayName"
                placeholder="Full Name"
                value={formData.displayName}
                onChange={handleInputChange}
                required
              />
            </InputGroup>
          )}

          <InputGroup>
            <InputIcon>
              <Mail size={16} />
            </InputIcon>
            <Input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </InputGroup>

          {mode !== 'reset' && (
            <InputGroup>
              <InputIcon>
                <Lock size={16} />
              </InputIcon>
              <Input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength={6}
              />
            </InputGroup>
          )}

          {mode === 'signup' && (
            <InputGroup>
              <InputIcon>
                <Lock size={16} />
              </InputIcon>
              <Input
                type="password"
                name="confirmPassword"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                minLength={6}
              />
            </InputGroup>
          )}

          <Button type="submit" disabled={loading}>
            {getButtonText()}
          </Button>
        </Form>

        {mode !== 'reset' && (
          <>
            <Divider>
              <span>or continue with</span>
            </Divider>

            <Button $variant="google" onClick={handleGoogleSignIn} disabled={loading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <Button $variant="github" onClick={handleGithubSignIn} disabled={loading}>
              <Github size={16} />
              Continue with GitHub
            </Button>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          {mode === 'login' && (
            <>
              <LinkButton onClick={() => setMode('signup')}>
                Don't have an account? Sign up
              </LinkButton>
              <br />
              <LinkButton onClick={() => setMode('reset')}>
                Forgot your password?
              </LinkButton>
            </>
          )}
          
          {mode === 'signup' && (
            <LinkButton onClick={() => setMode('login')}>
              Already have an account? Sign in
            </LinkButton>
          )}
          
          {mode === 'reset' && (
            <LinkButton onClick={() => setMode('login')}>
              Back to sign in
            </LinkButton>
          )}
        </div>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default AuthModal; 