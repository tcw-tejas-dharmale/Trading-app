import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Shield, Bell, Edit2, Save, X } from 'lucide-react';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: 'John Doe',
    email: user?.email || 'user@example.com',
    phone: '+1 (234) 567-890',
    bio: 'Active trader focused on technical analysis and market trends.',
  });

  const handleSave = () => {
    // Here you would typically save to backend
    setIsEditing(false);
    // Show success message
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data if needed
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
                  <span>📞</span>
                </div>
                <div className="detail-content">
                  <label className="detail-label">Phone Number</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      className="detail-input"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    />
                  ) : (
                    <p className="detail-value">{profileData.phone}</p>
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
                  <button className="btn btn-primary" onClick={handleSave}>
                    <Save size={16} />
                    Save Changes
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
                <button className="btn btn-outline btn-sm">Manage</button>
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
    </div>
  );
};

export default ProfilePage;

