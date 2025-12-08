import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Plus, Edit2, Trash2, User, Check, X, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Barber {
  barber_id: string;
  name: string;
  photo_url: string | null;
  specialties: string[] | null;
  is_working_today: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface BarbersResponse {
  barbers: Barber[];
}

interface BarberFormData {
  name: string;
  photo_url: string;
  specialties: string;
  is_working_today: boolean;
  is_active: boolean;
  display_order: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminBarbersList: React.FC = () => {
  // ====================================================================
  // ZUSTAND STORE
  // ====================================================================
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const queryClient = useQueryClient();

  // ====================================================================
  // LOCAL STATE
  // ====================================================================
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [formData, setFormData] = useState<BarberFormData>({
    name: '',
    photo_url: '',
    specialties: '',
    is_working_today: true,
    is_active: true,
    display_order: 0,
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // ====================================================================
  // FETCH BARBERS
  // ====================================================================
  const {
    data: barbersData,
    isLoading: loadingBarbers,
    error: barbersError,
  } = useQuery<BarbersResponse>({
    queryKey: ['admin-barbers'],
    queryFn: async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/barbers`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        console.log('[Barbers] Fetched successfully:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('[Barbers] Fetch error:', error.response?.data || error.message);
        throw error;
      }
    },
  });

  // ====================================================================
  // CREATE BARBER MUTATION
  // ====================================================================
  const createBarberMutation = useMutation({
    mutationFn: async (data: BarberFormData) => {
      const specialtiesArray = data.specialties
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/barbers`,
        {
          name: data.name,
          photo_url: data.photo_url || null,
          specialties: specialtiesArray.length > 0 ? specialtiesArray : null,
          is_working_today: data.is_working_today,
          is_active: data.is_active,
          display_order: data.display_order,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-barbers'] });
      toast.success('Barber added successfully');
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add barber');
    },
  });

  // ====================================================================
  // UPDATE BARBER MUTATION
  // ====================================================================
  const updateBarberMutation = useMutation({
    mutationFn: async (data: { barber_id: string; updates: Partial<BarberFormData> }) => {
      const updates: any = { ...data.updates };
      
      if (updates.specialties !== undefined) {
        const specialtiesArray = updates.specialties
          .split(',')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
        updates.specialties = specialtiesArray.length > 0 ? specialtiesArray : null;
      }

      const response = await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/barbers/${data.barber_id}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-barbers'] });
      toast.success('Barber updated successfully');
      setIsEditDialogOpen(false);
      setSelectedBarber(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update barber');
    },
  });

  // ====================================================================
  // DELETE BARBER MUTATION
  // ====================================================================
  const deleteBarberMutation = useMutation({
    mutationFn: async (barber_id: string) => {
      const response = await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/barbers/${barber_id}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-barbers'] });
      toast.success('Barber deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedBarber(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete barber');
    },
  });

  // ====================================================================
  // HELPER FUNCTIONS
  // ====================================================================
  const resetForm = () => {
    setFormData({
      name: '',
      photo_url: '',
      specialties: '',
      is_working_today: true,
      is_active: true,
      display_order: 0,
    });
    setPhotoPreview(null);
    setUploadingPhoto(false);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB.');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/upload/barber-photo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.photoUrl) {
        setFormData(prev => ({ ...prev, photo_url: response.data.photoUrl }));
        toast.success('Photo uploaded successfully');
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload photo');
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photo_url: '' }));
    setPhotoPreview(null);
  };

  const handleAddBarber = () => {
    setIsAddDialogOpen(true);
    resetForm();
  };

  const handleEditBarber = (barber: Barber) => {
    setSelectedBarber(barber);
    setFormData({
      name: barber.name,
      photo_url: barber.photo_url || '',
      specialties: barber.specialties ? barber.specialties.join(', ') : '',
      is_working_today: barber.is_working_today,
      is_active: barber.is_active,
      display_order: barber.display_order,
    });
    setPhotoPreview(null); // Clear preview, will use photo_url for display
    setIsEditDialogOpen(true);
  };

  const handleDeleteBarber = (barber: Barber) => {
    setSelectedBarber(barber);
    setIsDeleteDialogOpen(true);
  };

  const handleToggleWorkingToday = async (barber: Barber) => {
    try {
      await updateBarberMutation.mutateAsync({
        barber_id: barber.barber_id,
        updates: { is_working_today: !barber.is_working_today },
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleToggleActive = async (barber: Barber) => {
    try {
      await updateBarberMutation.mutateAsync({
        barber_id: barber.barber_id,
        updates: { is_active: !barber.is_active },
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSaveAdd = () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a barber name');
      return;
    }
    createBarberMutation.mutate(formData);
  };

  const handleSaveEdit = () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a barber name');
      return;
    }
    if (selectedBarber) {
      updateBarberMutation.mutate({
        barber_id: selectedBarber.barber_id,
        updates: formData,
      });
    }
  };

  const handleConfirmDelete = () => {
    if (selectedBarber) {
      deleteBarberMutation.mutate(selectedBarber.barber_id);
    }
  };

  // ====================================================================
  // RENDER
  // ====================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#600000] via-[#730000] to-[#8b0000]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#730000] to-[#8b0000] text-master-text-primary-dark shadow-master-elevated border-b border-white/15">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-master-text-primary-dark">Barber Management</h1>
              <p className="text-master-text-secondary-dark">Manage your barbers and their availability</p>
            </div>
            <Button onClick={handleAddBarber} className="flex items-center gap-2 bg-white text-master-text-primary-light hover:bg-gray-100 font-semibold shadow-lg">
              <Plus className="h-5 w-5" />
              Add Barber
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {loadingBarbers ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
            <p className="mt-4 text-master-text-secondary-dark">Loading barbers...</p>
          </div>
        ) : barbersError ? (
          <Card className="glass-card-light border-white/25">
            <CardContent className="text-center py-12">
              <div className="text-red-500 mb-4">
                <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-master-text-primary-dark mb-2">Error loading barbers</h3>
              <p className="text-master-text-secondary-dark mb-4">
                {(barbersError as any)?.response?.data?.message || (barbersError as any)?.message || 'Please try again.'}
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-white text-master-text-primary-light hover:bg-gray-100 font-semibold"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : barbersData?.barbers && barbersData.barbers.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-16 w-16 text-master-text-secondary-dark mx-auto mb-4" />
            <h3 className="text-lg font-medium text-master-text-primary-dark mb-2">No barbers added yet</h3>
            <p className="text-master-text-secondary-dark mb-4">Click 'Add Barber' to create your first barber.</p>
            <Button onClick={handleAddBarber} className="bg-white text-master-text-primary-light hover:bg-gray-100 font-semibold">
              <Plus className="h-5 w-5 mr-2" />
              Add Barber
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {barbersData?.barbers.map((barber) => (
              <Card key={barber.barber_id} className="glass-card-light hover:shadow-master-elevated transition-shadow border-white/25">
                <CardHeader className="border-b border-white/15">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {barber.photo_url ? (
                        <img
                          src={barber.photo_url}
                          alt={barber.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-[#6B2020] border-2 border-white/20 flex items-center justify-center">
                          <User className="h-8 w-8 text-master-text-primary-dark" />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-xl text-master-text-primary-dark">{barber.name}</CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge variant={barber.is_active ? 'default' : 'secondary'} className={barber.is_active ? 'bg-blue-600 text-master-text-primary-dark border-blue-500' : 'bg-gray-700 text-master-text-secondary-dark border-gray-600'}>
                            {barber.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {barber.is_working_today && barber.is_active && (
                            <Badge variant="outline" className="bg-green-600/20 text-green-200 border-green-500/50 font-semibold">
                              Working Today
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {barber.specialties && barber.specialties.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-master-text-secondary-dark font-semibold mb-2">Specialties:</p>
                      <div className="flex flex-wrap gap-1">
                        {barber.specialties.map((specialty, index) => (
                          <span
                            key={index}
                            className="text-xs bg-[#6B2020] text-master-text-primary-dark px-2 py-1 rounded border border-white/10"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between py-2 border-t border-white/15">
                      <span className="text-sm text-master-text-primary-dark font-medium">Working Today</span>
                      <Switch
                        checked={barber.is_working_today}
                        onCheckedChange={() => handleToggleWorkingToday(barber)}
                        disabled={!barber.is_active}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2 border-t border-white/15">
                      <span className="text-sm text-master-text-primary-dark font-medium">Active Status</span>
                      <Switch
                        checked={barber.is_active}
                        onCheckedChange={() => handleToggleActive(barber)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditBarber(barber)}
                      className="flex-1 bg-white/10 text-master-text-primary-dark border-white/25 hover:bg-white/20 hover:text-master-text-primary-dark font-medium"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBarber(barber)}
                      className="text-red-300 border-red-500/50 bg-red-600/20 hover:text-red-200 hover:bg-red-600/30 hover:border-red-500/70 font-medium"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Barber Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Barber</DialogTitle>
            <DialogDescription>
              Add a new barber to your team. Fill in their details below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Ahmed, Samir, Mo"
              />
            </div>
            
            {/* Photo Upload Section */}
            <div className="grid gap-2">
              <Label>Photo (optional)</Label>
              <div className="space-y-3">
                {photoPreview || formData.photo_url ? (
                  <div className="relative">
                    <img
                      src={photoPreview || formData.photo_url}
                      alt="Photo preview"
                      className="w-32 h-32 rounded-lg object-cover border-2 border-gray-200"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2"
                      onClick={handleRemovePhoto}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="cursor-pointer"
                    />
                  </div>
                  {uploadingPhoto && (
                    <div className="flex items-center text-sm text-master-text-muted-dark">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uploading...
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-master-text-muted-dark">
                  Or paste a photo URL below
                </div>
                <Input
                  id="photo_url"
                  value={formData.photo_url}
                  onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="specialties">Specialties (comma-separated, optional)</Label>
              <Input
                id="specialties"
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                placeholder="Fade, Beard Trim, Classic Cuts"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="is_working_today">Working Today</Label>
              <Switch
                id="is_working_today"
                checked={formData.is_working_today}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_working_today: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAdd} disabled={createBarberMutation.isPending}>
              {createBarberMutation.isPending ? 'Adding...' : 'Add Barber'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Barber Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Barber</DialogTitle>
            <DialogDescription>Update barber details and settings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit_name">Name *</Label>
              <Input
                id="edit_name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            {/* Photo Upload Section */}
            <div className="grid gap-2">
              <Label>Photo (optional)</Label>
              <div className="space-y-3">
                {photoPreview || formData.photo_url ? (
                  <div className="relative">
                    <img
                      src={photoPreview || formData.photo_url}
                      alt="Photo preview"
                      className="w-32 h-32 rounded-lg object-cover border-2 border-gray-200"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2"
                      onClick={handleRemovePhoto}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="cursor-pointer"
                    />
                  </div>
                  {uploadingPhoto && (
                    <div className="flex items-center text-sm text-master-text-muted-dark">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Uploading...
                    </div>
                  )}
                </div>
                
                <div className="text-xs text-master-text-muted-dark">
                  Or paste a photo URL below
                </div>
                <Input
                  id="edit_photo_url"
                  value={formData.photo_url}
                  onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit_specialties">Specialties (comma-separated, optional)</Label>
              <Input
                id="edit_specialties"
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                placeholder="Fade, Beard Trim, Classic Cuts"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_display_order">Display Order</Label>
              <Input
                id="edit_display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="edit_is_working_today">Working Today</Label>
              <Switch
                id="edit_is_working_today"
                checked={formData.is_working_today}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_working_today: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="edit_is_active">Active</Label>
              <Switch
                id="edit_is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateBarberMutation.isPending}>
              {updateBarberMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Barber</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedBarber?.name}? This action cannot be undone.
              All associated bookings will have their barber assignment removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteBarberMutation.isPending}
            >
              {deleteBarberMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UV_AdminBarbersList;
