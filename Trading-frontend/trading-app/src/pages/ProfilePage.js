import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Bell, Edit2, Save, X, Eye, EyeOff } from 'lucide-react';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || user?.email || 'User',
    email: user?.email || 'user@example.com',
    bio: 'Active trader focused on technical analysis and market trends.',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!user || isEditing) {
      return;
    }
    setProfileData((prev) => ({
      ...prev,
      name: user.name || user.email || 'User',
      email: user.email || 'user@example.com',
    }));
  }, [user, isEditing]);

  const handleSave = async () => {
    if (!updateProfile) {
      setError('Profile updates are not available.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const updatedUser = await updateProfile({
        name: profileData.name,
        email: profileData.email,
      });
      setProfileData((prev) => ({
        ...prev,
        name: updatedUser.name || prev.name,
        email: updatedUser.email || prev.email,
      }));
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data if needed
  };

  const handlePasswordSave = async () => {
    if (!updateProfile) {
      setPasswordError('Password updates are not available.');
      return;
    }
    if (!user) {
      setPasswordError('Please sign in to change your password.');
      return;
    }
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      setPasswordError('Please fill out all password fields.');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordSaving(true);
    try {
      await updateProfile({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      });
      setPasswordSuccess('Password updated successfully.');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowSecurity(false);
    } catch (err) {
      setPasswordError('Failed to update password. Please check your current password.');
      console.error(err);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-header">
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account settings and preferences</p>
        </div>

        <div className="profile-content">
          {/* Profile Card */}
          <div className="profile-card card">
            <div className="profile-avatar-section">
              <div className="profile-avatar">
                <User size={48} />
              </div>
              <div className="profile-info">
                <h2 className="profile-name">{profileData.name}</h2>
                <p className="profile-email">{profileData.email}</p>
                <span className="profile-status">
                  {user ? 'Verified Account' : 'Guest User'}
                </span>
              </div>
              {!isEditing && (
                <button
                  className="btn btn-outline edit-btn"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 size={16} />
                  Edit Profile
                </button>
              )}
            </div>

            <div className="profile-details">
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}
              <div className="detail-item">
                <div className="detail-icon">
                  <User size={20} />
                </div>
                <div className="detail-content">
                  <label className="detail-label">Full Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      className="detail-input"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    />
                  ) : (
                    <p className="detail-value">{profileData.name}</p>
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-icon">
                  <Mail size={20} />
                </div>
                <div className="detail-content">
                  <label className="detail-label">Email Address</label>
                  {isEditing ? (
                    <input
                      type="email"
                      className="detail-input"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    />
                  ) : (
                    <p className="detail-value">{profileData.email}</p>
                  )}
                </div>
              </div>

              <div className="detail-item">
                <div className="detail-icon">
                  <User size={20} />
                </div>
                <div className="detail-content">
                  <label className="detail-label">Bio</label>
                  {isEditing ? (
                    <textarea
                      className="detail-textarea"
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      rows="3"
                    />
                  ) : (
                    <p className="detail-value">{profileData.bio}</p>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="profile-actions">
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="btn btn-outline" onClick={handleCancel}>
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Settings Card */}
          <div className="settings-card card">
            <h3 className="settings-title">Account Settings</h3>
            <div className="settings-list">
              <div className="setting-item">
                <div className="setting-icon">
                  <Shield size={20} />
                </div>
                <div className="setting-content">
                  <h4 className="setting-name">Security</h4>
                  <p className="setting-description">Manage password and security settings</p>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setPasswordError('');
                    setPasswordSuccess('');
                    setShowSecurity(true);
                  }}
                >
                  Manage
                </button>
              </div>

              <div className="setting-item">
                <div className="setting-icon">
                  <Bell size={20} />
                </div>
                <div className="setting-content">
                  <h4 className="setting-name">Notifications</h4>
                  <p className="setting-description">Configure email and push notifications</p>
                </div>
                <button className="btn btn-outline btn-sm">Configure</button>
              </div>
            </div>

          </div>

          {!user && (
            <div className="info-card card">
              <h3 className="info-title">Sign In Required</h3>
              <p className="info-text">
                Sign in to save your profile information and access all features.
              </p>
              <a href="/login" className="btn btn-primary">Sign In</a>
            </div>
          )}
        </div>
      </div>

      {showSecurity && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowSecurity(false);
            setPasswordError('');
            setPasswordSuccess('');
          }}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h4 className="security-title">Change Password</h4>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowSecurity(false);
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            {passwordError && (
              <div className="error-message">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="success-message">
                {passwordSuccess}
              </div>
            )}
            <div className="security-field">
              <label className="detail-label">Current Password</label>
              <div className="password-input">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="detail-input"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPasswords((prev) => !prev)}
                  aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="security-field">
              <label className="detail-label">New Password</label>
              <div className="password-input">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="detail-input"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPasswords((prev) => !prev)}
                  aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="security-field">
              <label className="detail-label">Confirm New Password</label>
              <div className="password-input">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="detail-input"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPasswords((prev) => !prev)}
                  aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                >
                  {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="profile-actions security-actions">
              <button
                className="btn btn-primary"
                onClick={handlePasswordSave}
                disabled={passwordSaving}
              >
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setShowSecurity(false);
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                disabled={passwordSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
