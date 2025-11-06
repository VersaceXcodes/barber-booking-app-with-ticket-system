import React, { useState } from 'react';
import { useAppStore } from '@/store/main';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, CheckCircle, XCircle, Edit2, Save, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || window.location.origin;
};

const UV_UserProfile: React.FC = () => {
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const updateCurrentUser = useAppStore(state => state.update_current_user);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { name: string; phone: string }) => {
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      const response = await axios.patch(
        `${getApiBaseUrl()}/api/auth/me`,
        updates,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return response.data;
    },
    onSuccess: (data) => {
      if (data.user) {
        updateCurrentUser({
          name: data.user.name,
          phone: data.user.phone,
        });
        setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
        setTimeout(() => setSaveMessage(null), 3000);
      }
      setIsEditing(false);
      setIsSaving(false);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.message || 'Failed to update profile';
      setSaveMessage({ type: 'error', text: errorMsg });
      setTimeout(() => setSaveMessage(null), 5000);
      setIsSaving(false);
    },
  });

  const handleEditToggle = () => {
    if (isEditing) {
      setFormData({
        name: currentUser?.name || '',
        phone: currentUser?.phone || '',
      });
      setSaveMessage(null);
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setSaveMessage({ type: 'error', text: 'Name is required' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    await updateProfileMutation.mutateAsync({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading user profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-2 text-gray-600">Manage your account information and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Account Information</CardTitle>
                <CardDescription>Your personal details and account status</CardDescription>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={handleEditToggle} variant="outline" size="sm">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSave} size="sm" disabled={isSaving}>
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button onClick={handleEditToggle} variant="outline" size="sm" disabled={isSaving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {saveMessage && (
              <div className={`p-4 rounded-lg ${
                saveMessage.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <p className="text-sm font-medium">{saveMessage.text}</p>
              </div>
            )}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {currentUser.is_verified ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">Account Status</p>
                    <p className="text-sm text-gray-600">
                      {currentUser.is_verified ? 'Your account is verified' : 'Account not verified'}
                    </p>
                  </div>
                </div>
                <Badge variant={currentUser.is_verified ? 'default' : 'secondary'}>
                  {currentUser.is_verified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name
                </Label>
                {isEditing ? (
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-gray-900">{currentUser.name}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-gray-900">{currentUser.email}</p>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-gray-900">{currentUser.phone}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Member since:</span>{' '}
                  {new Date(currentUser.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Password & Security</CardTitle>
            <CardDescription>Manage your password and security settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">
              Change Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UV_UserProfile;
