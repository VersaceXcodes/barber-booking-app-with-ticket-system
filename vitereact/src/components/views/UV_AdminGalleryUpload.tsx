import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

interface UploadQueueItem {
  temp_id: string;
  file: File;
  filename: string;
  preview_url: string;
  upload_progress: number;
  upload_status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';
  uploaded_image_id: string | null;
  caption: string | null;
  service_id: string | null;
  error_message: string | null;
}

interface Service {
  service_id: string;
  name: string;
}

interface ValidationError {
  filename: string;
  error: string;
}

const UV_AdminGalleryUpload: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [draggingOverZone, setDraggingOverZone] = useState(false);
  const [uploadingInProgress, setUploadingInProgress] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // CRITICAL: Individual selector for auth token
  const authToken = useAppStore(state => state.authentication_state.auth_token);

  // Fetch services for association dropdown
  const { data: servicesData } = useQuery({
    queryKey: ['services', 'active'],
    queryFn: async () => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/services`,
        {
          params: { is_active: true },
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );
      return response.data;
    },
    select: (data) => {
      // Extract only service_id and name for dropdown
      return data.map((s: any) => ({
        service_id: s.service_id,
        name: s.name
      }));
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });

  const servicesList: Service[] = servicesData || [];

  // Validate file format and size
  const validateFile = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      return `Invalid file format. Please upload JPG, PNG, or WebP images only.`;
    }

    if (file.size > maxSize) {
      return `File exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB).`;
    }

    return null;
  };

  // Add files to upload queue
  const addFilesToQueue = (files: FileList | File[]) => {
    const filesArray = Array.from(files);
    const newErrors: ValidationError[] = [];
    const validFiles: UploadQueueItem[] = [];

    filesArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        newErrors.push({ filename: file.name, error });
      } else {
        // Create preview URL using FileReader
        const preview_url = URL.createObjectURL(file);
        const temp_id = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        validFiles.push({
          temp_id,
          file,
          filename: file.name,
          preview_url,
          upload_progress: 0,
          upload_status: 'pending',
          uploaded_image_id: null,
          caption: null,
          service_id: null,
          error_message: null
        });
      }
    });

    setValidationErrors(prev => [...prev, ...newErrors]);
    setUploadQueue(prev => [...prev, ...validFiles]);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingOverZone(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingOverZone(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingOverZone(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  // Update caption for specific file
  const updateCaption = (temp_id: string, caption: string) => {
    setUploadQueue(prev => prev.map(item =>
      item.temp_id === temp_id ? { ...item, caption } : item
    ));
  };

  // Update service association for specific file
  const updateServiceAssociation = (temp_id: string, service_id: string | null) => {
    setUploadQueue(prev => prev.map(item =>
      item.temp_id === temp_id ? { ...item, service_id } : item
    ));
  };

  // Remove file from queue
  const removeFileFromQueue = (temp_id: string) => {
    const item = uploadQueue.find(i => i.temp_id === temp_id);
    if (item) {
      URL.revokeObjectURL(item.preview_url);
    }
    setUploadQueue(prev => prev.filter(i => i.temp_id !== temp_id));
  };

  // Upload single file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (item: UploadQueueItem) => {
      const formData = new FormData();
      formData.append('image', item.file);
      if (item.caption) {
        formData.append('caption', item.caption);
      }
      if (item.service_id) {
        formData.append('service_id', item.service_id);
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/admin/gallery`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadQueue(prev => prev.map(i =>
                i.temp_id === item.temp_id
                  ? { ...i, upload_progress: progress, upload_status: 'uploading' }
                  : i
              ));
            }
          }
        }
      );

      return response.data;
    },
    onSuccess: (data, item) => {
      setUploadQueue(prev => prev.map(i =>
        i.temp_id === item.temp_id
          ? {
              ...i,
              upload_status: 'success',
              upload_progress: 100,
              uploaded_image_id: data.image_id || data.data?.image_id
            }
          : i
      ));
    },
    onError: (error: any, item) => {
      const errorMessage = error.response?.data?.error?.message || error.message || 'Upload failed';
      setUploadQueue(prev => prev.map(i =>
        i.temp_id === item.temp_id
          ? {
              ...i,
              upload_status: 'error',
              error_message: errorMessage
            }
          : i
      ));
    }
  });

  // Submit all uploads sequentially
  const handleSubmitAllUploads = async () => {
    setUploadingInProgress(true);

    for (const item of uploadQueue) {
      if (item.upload_status === 'pending' || item.upload_status === 'error') {
        await uploadFileMutation.mutateAsync(item);
      }
    }

    setUploadingInProgress(false);

    // Check if all successful
    const allSuccess = uploadQueue.every(item => item.upload_status === 'success');
    if (allSuccess) {
      // Navigate to gallery manage with success message
      navigate('/admin/gallery', {
        state: { successMessage: `${uploadQueue.length} images uploaded successfully!` }
      });
    }
  };

  // Cancel and return
  const handleCancel = () => {
    // Revoke object URLs to prevent memory leaks
    uploadQueue.forEach(item => {
      URL.revokeObjectURL(item.preview_url);
    });
    setUploadQueue([]);
    navigate('/admin/gallery');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      uploadQueue.forEach(item => {
        URL.revokeObjectURL(item.preview_url);
      });
    };
  }, []);

  const hasFilesInQueue = uploadQueue.length > 0;
  const allUploaded = uploadQueue.every(item => item.upload_status === 'success');
  const canSubmit = hasFilesInQueue && !uploadingInProgress && !allUploaded;

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Upload Gallery Images</h1>
              <Link
                to="/admin/gallery"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                ← Back to Gallery
              </Link>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="h-5 w-5 text-red-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-900 mb-2">Invalid Files:</h3>
                  <ul className="space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="text-sm text-red-700">
                        <strong>{error.filename}:</strong> {error.error}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setValidationErrors([])}
                    className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium underline"
                  >
                    Clear Errors
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload Zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
              ${draggingOverZone
                ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Upload Cloud Icon */}
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>

            <p className="text-lg font-semibold text-gray-900 mb-2">
              Drag and drop images here or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-6">
              JPG, PNG, WebP • Max 10MB per file
            </p>

            <button
              type="button"
              className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Browse Files
            </button>
          </div>

          {/* Upload Queue */}
          {hasFilesInQueue && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Files to Upload ({uploadQueue.length})
              </h2>

              <div className="space-y-4">
                {uploadQueue.map((item) => (
                  <div
                    key={item.temp_id}
                    className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start space-x-4">
                      {/* Thumbnail Preview */}
                      <div className="flex-shrink-0">
                        <img
                          src={item.preview_url}
                          alt={item.filename}
                          className="h-24 w-24 object-cover rounded-lg border border-gray-200"
                        />
                      </div>

                      {/* File Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate mb-2">
                          {item.filename}
                        </p>

                        {/* Status Indicators */}
                        <div className="mb-3">
                          {item.upload_status === 'pending' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Pending Upload
                            </span>
                          )}
                          {item.upload_status === 'uploading' && (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-sm text-blue-600 font-medium">Uploading...</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                  style={{ width: `${item.upload_progress}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-500">{item.upload_progress}%</p>
                            </div>
                          )}
                          {item.upload_status === 'success' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <svg className="h-3.5 w-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Uploaded Successfully
                            </span>
                          )}
                          {item.upload_status === 'error' && (
                            <div className="space-y-1">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <svg className="h-3.5 w-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Upload Failed
                              </span>
                              {item.error_message && (
                                <p className="text-xs text-red-600">{item.error_message}</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Caption Input - Only for pending/error */}
                        {(item.upload_status === 'pending' || item.upload_status === 'error') && (
                          <div className="mb-3">
                            <label htmlFor={`caption-${item.temp_id}`} className="block text-xs font-medium text-gray-700 mb-1">
                              Caption (optional)
                            </label>
                            <input
                              id={`caption-${item.temp_id}`}
                              type="text"
                              value={item.caption || ''}
                              onChange={(e) => updateCaption(item.temp_id, e.target.value)}
                              placeholder="e.g., Skin Fade, Curly Cut"
                              maxLength={100}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              {item.caption?.length || 0}/100 characters
                            </p>
                          </div>
                        )}

                        {/* Service Association - Only for pending/error */}
                        {(item.upload_status === 'pending' || item.upload_status === 'error') && (
                          <div>
                            <label htmlFor={`service-${item.temp_id}`} className="block text-xs font-medium text-gray-700 mb-1">
                              Service Association
                            </label>
                            <select
                              id={`service-${item.temp_id}`}
                              value={item.service_id || ''}
                              onChange={(e) => updateServiceAssociation(item.temp_id, e.target.value || null)}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            >
                              <option value="">None</option>
                              {servicesList.map((service) => (
                                <option key={service.service_id} value={service.service_id}>
                                  {service.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Remove Button - Only for pending/error */}
                      {(item.upload_status === 'pending' || item.upload_status === 'error') && (
                        <button
                          onClick={() => removeFileFromQueue(item.temp_id)}
                          className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                          title="Remove file"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex items-center justify-end space-x-4">
                <button
                  onClick={handleCancel}
                  disabled={uploadingInProgress}
                  className="px-6 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAllUploads}
                  disabled={!canSubmit}
                  className="px-6 py-3 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {uploadingInProgress ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading Images...
                    </span>
                  ) : allUploaded ? (
                    <span className="flex items-center">
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      All Uploaded!
                    </span>
                  ) : (
                    `Upload ${uploadQueue.length} Image${uploadQueue.length > 1 ? 's' : ''}`
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!hasFilesInQueue && (
            <div className="mt-12 text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 text-sm">
                No files selected yet. Drag and drop images above or click to browse.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UV_AdminGalleryUpload;