import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAppStore } from '@/store/main';
import { Camera, Edit2, Trash2, X, GripVertical, Grid, List, Upload } from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface GalleryImage {
  image_id: string;
  image_url: string;
  thumbnail_url: string;
  caption: string | null;
  service_id: string | null;
  display_order: number;
  uploaded_at: string;
}

interface Service {
  service_id: string;
  name: string;
  is_callout?: boolean;
}

interface UpdateImagePayload {
  caption?: string | null;
  service_id?: string | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UV_AdminGalleryManage: React.FC = () => {
  // URL params
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Global state (individual selectors - CRITICAL)
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  
  // Local state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'manual' | 'newest' | 'oldest'>(
    (searchParams.get('sort') as 'manual' | 'newest' | 'oldest') || 'manual'
  );
  const [serviceFilter, setServiceFilter] = useState<string | null>(
    searchParams.get('service_filter') || null
  );
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [tempCaptionValue, setTempCaptionValue] = useState<string>('');
  const [editModalState, setEditModalState] = useState<GalleryImage | null>(null);
  const [deleteModalState, setDeleteModalState] = useState<GalleryImage | string[] | null>(null);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  
  // Refs for debouncing
  const captionDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const queryClient = useQueryClient();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  
  // ============================================================================
  // API QUERIES
  // ============================================================================
  
  // Fetch gallery images
  const { data: galleryImages = [], isLoading: loadingImages } = useQuery({
    queryKey: ['admin-gallery', serviceFilter, sortOrder],
    queryFn: async () => {
      const params: any = {
        limit: 100,
      };
      
      if (serviceFilter) {
        params.service_id = serviceFilter;
      }
      
      // Map sort order to backend field
      if (sortOrder === 'manual') {
        params.sort_by = 'display_order';
        params.sort_order = 'asc';
      } else if (sortOrder === 'newest') {
        params.sort_by = 'uploaded_at';
        params.sort_order = 'desc';
      } else {
        params.sort_by = 'uploaded_at';
        params.sort_order = 'asc';
      }
      
      const response = await axios.get(`${apiBaseUrl}/api/admin/gallery`, {
        params,
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      // Map backend response to frontend structure
      return response.data.map((img: any) => ({
        image_id: img.image_id,
        image_url: img.image_url,
        thumbnail_url: img.thumbnail_url,
        caption: img.caption,
        service_id: img.service_id,
        display_order: img.display_order,
        uploaded_at: img.uploaded_at,
      })) as GalleryImage[];
    },
    staleTime: 30000,
  });
  
  // Fetch services for filter
  const { data: servicesList = [] } = useQuery({
    queryKey: ['services-active'],
    queryFn: async () => {
      const response = await axios.get(`${apiBaseUrl}/api/services`, {
        params: { is_active: true },
      });
      
      return (response.data.services || []).map((s: any) => ({
        service_id: s.service_id,
        name: s.name,
      })) as Service[];
    },
    staleTime: 60000,
  });
  
  // ============================================================================
  // MUTATIONS
  // ============================================================================
  
  // Update image caption (inline or modal)
  const updateImageMutation = useMutation({
    mutationFn: async ({ image_id, payload }: { image_id: string; payload: UpdateImagePayload }) => {
      const response = await axios.patch(
        `${apiBaseUrl}/api/admin/gallery/${image_id}`,
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] });
    },
  });
  
  // Delete single image
  const deleteImageMutation = useMutation({
    mutationFn: async (image_id: string) => {
      await axios.delete(`${apiBaseUrl}/api/admin/gallery/${image_id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] });
      setDeleteModalState(null);
      setSelectedImages(new Set());
    },
  });
  
  // Delete bulk images
  const deleteBulkMutation = useMutation({
    mutationFn: async (image_ids: string[]) => {
      await Promise.all(
        image_ids.map(id =>
          axios.delete(`${apiBaseUrl}/api/admin/gallery/${id}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] });
      setDeleteModalState(null);
      setSelectedImages(new Set());
    },
  });
  
  // Reorder images
  const reorderMutation = useMutation({
    mutationFn: async (image_ids: string[]) => {
      await axios.post(
        `${apiBaseUrl}/api/admin/gallery/reorder`,
        { image_ids },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] });
    },
  });
  
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  // Handle inline caption editing
  const handleCaptionBlur = (image_id: string) => {
    if (captionDebounceRef.current) {
      clearTimeout(captionDebounceRef.current);
    }
    
    // Save immediately on blur
    updateImageMutation.mutate({
      image_id,
      payload: { caption: tempCaptionValue || null },
    });
    
    setEditingCaptionId(null);
    setTempCaptionValue('');
  };
  
  const handleCaptionChange = (value: string) => {
    setTempCaptionValue(value);
    
    // Clear existing timeout
    if (captionDebounceRef.current) {
      clearTimeout(captionDebounceRef.current);
    }
  };
  
  // Handle edit modal save
  const handleEditModalSave = () => {
    if (!editModalState) return;
    
    updateImageMutation.mutate({
      image_id: editModalState.image_id,
      payload: {
        caption: editModalState.caption,
        service_id: editModalState.service_id,
      },
    });
    
    setEditModalState(null);
  };
  
  // Handle single delete
  const handleDeleteConfirm = () => {
    if (!deleteModalState) return;
    
    if (Array.isArray(deleteModalState)) {
      // Bulk delete
      deleteBulkMutation.mutate(deleteModalState);
    } else {
      // Single delete
      deleteImageMutation.mutate(deleteModalState.image_id);
    }
  };
  
  // Handle image selection
  const toggleImageSelection = (image_id: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(image_id)) {
      newSelected.delete(image_id);
    } else {
      newSelected.add(image_id);
    }
    setSelectedImages(newSelected);
  };
  
  const selectAllImages = () => {
    setSelectedImages(new Set(galleryImages.map(img => img.image_id)));
  };
  
  const deselectAllImages = () => {
    setSelectedImages(new Set());
  };
  
  // Handle drag and drop
  const handleDragStart = (e: React.DragEvent, image_id: string) => {
    setDraggingImageId(image_id);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropTargetIndex(index);
  };
  
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggingImageId) return;
    
    const dragIndex = galleryImages.findIndex(img => img.image_id === draggingImageId);
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDraggingImageId(null);
      setDropTargetIndex(null);
      return;
    }
    
    // Reorder array
    const newOrder = [...galleryImages];
    const [draggedItem] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, draggedItem);
    
    // Save new order
    reorderMutation.mutate(newOrder.map(img => img.image_id));
    
    setDraggingImageId(null);
    setDropTargetIndex(null);
  };
  
  const handleDragEnd = () => {
    setDraggingImageId(null);
    setDropTargetIndex(null);
  };
  
  // Update URL params when filters change
  useEffect(() => {
    const params: any = {};
    if (serviceFilter) params.service_filter = serviceFilter;
    if (sortOrder !== 'manual') params.sort = sortOrder;
    setSearchParams(params);
  }, [serviceFilter, sortOrder, setSearchParams]);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-master-text-primary-dark">Gallery Management</h1>
          </div>
          
          {/* Tab Navigation */}
          <div className="mb-6 border-b border-white/10">
            <nav className="-mb-px flex space-x-8">
              <button
                className="border-b-2 border-blue-500 py-4 px-1 text-sm font-medium text-amber-400"
              >
                All Images
              </button>
              <Link
                to="/admin/gallery/upload"
                className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-master-text-muted-dark hover:border-white/20 hover:text-master-text-secondary-dark"
              >
                Upload New
              </Link>
              <button
                className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-master-text-muted-dark hover:border-white/20 hover:text-master-text-secondary-dark"
              >
                Settings
              </button>
            </nav>
          </div>
          
          {/* Controls */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="flex rounded-lg border border-white/20 bg-white">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark'
                      : 'text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-master-text-primary-dark'
                      : 'text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              {/* Sort Dropdown */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'manual' | 'newest' | 'oldest')}
                className="rounded-lg border border-white/20 bg-[#2D0808] px-4 py-2 text-sm font-medium text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="manual">Manual Order</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              
              {/* Service Filter */}
              <select
                value={serviceFilter || ''}
                onChange={(e) => setServiceFilter(e.target.value || null)}
                className="rounded-lg border border-white/20 bg-[#2D0808] px-4 py-2 text-sm font-medium text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">All Services</option>
                {servicesList.map(service => (
                  <option key={service.service_id} value={service.service_id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Bulk Actions Toolbar */}
            {selectedImages.size > 0 && (
              <div className="flex items-center gap-4 bg-[#2D0808] border border-blue-200 rounded-lg px-4 py-2">
                <span className="text-sm font-medium text-blue-900">
                  {selectedImages.size} selected
                </span>
                <button
                  onClick={() => setDeleteModalState(Array.from(selectedImages))}
                  className="text-sm font-medium text-red-600 hover:text-red-300"
                >
                  Delete Selected
                </button>
                <button
                  onClick={deselectAllImages}
                  className="text-sm font-medium text-master-text-secondary-dark hover:text-master-text-secondary-dark"
                >
                  Deselect All
                </button>
              </div>
            )}
          </div>
          
          {/* Loading State */}
          {loadingImages && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
          )}
          
          {/* Empty State */}
          {!loadingImages && galleryImages.length === 0 && (
            <div className="text-center py-12">
              <Camera className="mx-auto h-12 w-12 text-master-text-muted-dark" />
              <h3 className="mt-2 text-sm font-medium text-master-text-primary-dark">No gallery images yet</h3>
              <p className="mt-1 text-sm text-master-text-muted-dark">Get started by uploading your first photo.</p>
              <div className="mt-6">
                <Link
                  to="/admin/gallery/upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-master-text-primary-dark bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Your First Photo
                </Link>
              </div>
            </div>
          )}
          
          {/* Grid View */}
          {!loadingImages && galleryImages.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {galleryImages.map((image, index) => (
                <div
                  key={image.image_id}
                  draggable={sortOrder === 'manual'}
                  onDragStart={(e) => sortOrder === 'manual' && handleDragStart(e, image.image_id)}
                  onDragOver={(e) => sortOrder === 'manual' && handleDragOver(e, index)}
                  onDrop={(e) => sortOrder === 'manual' && handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`bg-[#2D0808] rounded-lg shadow-md overflow-hidden border-2 transition-all ${
                    draggingImageId === image.image_id
                      ? 'opacity-50 scale-105'
                      : dropTargetIndex === index
                      ? 'border-blue-500'
                      : 'border-transparent'
                  } ${selectedImages.has(image.image_id) ? 'ring-2 ring-red-500' : ''}`}
                >
                  {/* Checkbox & Drag Handle */}
                  <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedImages.has(image.image_id)}
                      onChange={() => toggleImageSelection(image.image_id)}
                      className="h-5 w-5 rounded border-white/20 text-amber-400 focus:ring-red-500"
                    />
                    {sortOrder === 'manual' && (
                      <div className="cursor-move bg-[#2D0808] rounded p-1 shadow">
                        <GripVertical className="w-4 h-4 text-master-text-muted-dark" />
                      </div>
                    )}
                  </div>
                  
                  {/* Image */}
                  <div className="relative aspect-square">
                    <img
                      src={image.thumbnail_url}
                      alt={image.caption || 'Gallery image'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Caption */}
                  <div className="p-3">
                    {editingCaptionId === image.image_id ? (
                      <input
                        type="text"
                        value={tempCaptionValue}
                        onChange={(e) => handleCaptionChange(e.target.value)}
                        onBlur={() => handleCaptionBlur(image.image_id)}
                        autoFocus
                        className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    ) : (
                      <p
                        onClick={() => {
                          setEditingCaptionId(image.image_id);
                          setTempCaptionValue(image.caption || '');
                        }}
                        className="text-sm text-master-text-primary-dark cursor-pointer hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] px-2 py-1 rounded min-h-[28px]"
                      >
                        {image.caption || 'Click to add caption...'}
                      </p>
                    )}
                    
                    {/* Service Tag */}
                    {image.service_id && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400">
                          {servicesList.find(s => s.service_id === image.service_id)?.name || 'Service'}
                        </span>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => setEditModalState(image)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-1.5 border border-white/20 shadow-sm text-xs font-medium rounded text-master-text-secondary-dark bg-[#2D0808] hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Edit2 className="mr-1 h-3 w-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteModalState(image)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded text-red-300 bg-[#2D0808] hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* List View */}
          {!loadingImages && galleryImages.length > 0 && viewMode === 'list' && (
            <div className="bg-[#2D0808] shadow overflow-hidden sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedImages.size === galleryImages.length}
                        onChange={() => {
                          if (selectedImages.size === galleryImages.length) {
                            deselectAllImages();
                          } else {
                            selectAllImages();
                          }
                        }}
                        className="h-4 w-4 rounded border-white/20 text-amber-400 focus:ring-red-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                      Caption
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-master-text-muted-dark uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#2D0808] divide-y divide-gray-200">
                  {galleryImages.map(image => (
                    <tr key={image.image_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedImages.has(image.image_id)}
                          onChange={() => toggleImageSelection(image.image_id)}
                          className="h-4 w-4 rounded border-white/20 text-amber-400 focus:ring-red-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <img
                          src={image.thumbnail_url}
                          alt={image.caption || 'Gallery image'}
                          className="h-16 w-16 object-cover rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-master-text-primary-dark">{image.caption || 'No caption'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {image.service_id ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-900/30 text-blue-400">
                            {servicesList.find(s => s.service_id === image.service_id)?.name || 'Service'}
                          </span>
                        ) : (
                          <span className="text-sm text-master-text-muted-dark">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-master-text-muted-dark">
                        {new Date(image.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setEditModalState(image)}
                          className="text-amber-400 hover:text-blue-900 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteModalState(image)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Edit Image Modal */}
      {editModalState && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]0 bg-opacity-75"
              onClick={() => setEditModalState(null)}
            ></div>
            
            <div className="inline-block align-bottom bg-[#2D0808] rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  onClick={() => setEditModalState(null)}
                  className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-md text-master-text-muted-dark hover:text-master-text-muted-dark focus:outline-none"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="sm:flex sm:items-start">
                <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                  <h3 className="text-lg leading-6 font-medium text-master-text-primary-dark mb-4">
                    Edit Image
                  </h3>
                  
                  {/* Image Preview */}
                  <div className="mb-4">
                    <img
                      src={editModalState.image_url}
                      alt={editModalState.caption || 'Gallery image'}
                      className="w-full max-h-96 object-contain rounded-lg"
                    />
                  </div>
                  
                  {/* Caption Input */}
                  <div className="mb-4">
                    <label htmlFor="edit-caption" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                      Caption
                    </label>
                    <input
                      id="edit-caption"
                      type="text"
                      value={editModalState.caption || ''}
                      onChange={(e) => setEditModalState({ ...editModalState, caption: e.target.value })}
                      className="w-full px-3 py-2 border border-white/20 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-blue-500"
                      placeholder="Enter image caption..."
                    />
                  </div>
                  
                  {/* Service Association */}
                  <div className="mb-4">
                    <label htmlFor="edit-service" className="block text-sm font-medium text-master-text-secondary-dark mb-2">
                      Service Association
                    </label>
                    <select
                      id="edit-service"
                      value={editModalState.service_id || ''}
                      onChange={(e) => setEditModalState({ ...editModalState, service_id: e.target.value || null })}
                      className="w-full px-3 py-2 border border-white/20 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-blue-500"
                    >
                      <option value="">None</option>
                      {servicesList.map(service => (
                        <option key={service.service_id} value={service.service_id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Metadata */}
                  <div className="mb-4 bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-master-text-secondary-dark mb-2">Metadata</h4>
                    <p className="text-sm text-master-text-secondary-dark">
                      <strong>Uploaded on:</strong> {new Date(editModalState.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                    <button
                      onClick={handleEditModalSave}
                      disabled={updateImageMutation.isPending}
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-base font-medium text-master-text-primary-dark hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm disabled:opacity-50"
                    >
                      {updateImageMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditModalState(null)}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-white/20 shadow-sm px-4 py-2 bg-[#2D0808] text-base font-medium text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setDeleteModalState(editModalState);
                        setEditModalState(null);
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-[#2D0808] text-base font-medium text-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Delete Image
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteModalState && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B]0 bg-opacity-75"
              onClick={() => setDeleteModalState(null)}
            ></div>
            
            <div className="inline-block align-bottom bg-[#2D0808] rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-master-text-primary-dark">
                    Delete Image{Array.isArray(deleteModalState) && deleteModalState.length > 1 ? 's' : ''}?
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-master-text-muted-dark">
                      This action cannot be undone. {Array.isArray(deleteModalState)
                        ? `${deleteModalState.length} image${deleteModalState.length > 1 ? 's' : ''} will be permanently deleted.`
                        : 'This image will be permanently deleted from storage.'}
                    </p>
                    {!Array.isArray(deleteModalState) && deleteModalState.caption && (
                      <p className="mt-2 text-sm font-medium text-master-text-secondary-dark">
                        "{deleteModalState.caption}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteImageMutation.isPending || deleteBulkMutation.isPending}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-master-text-primary-dark hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {(deleteImageMutation.isPending || deleteBulkMutation.isPending) ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setDeleteModalState(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-white/20 shadow-sm px-4 py-2 bg-[#2D0808] text-base font-medium text-master-text-secondary-dark hover:bg-gradient-to-br from-[#2A0A0A] via-[#3D0F0F] to-[#5C1B1B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UV_AdminGalleryManage;