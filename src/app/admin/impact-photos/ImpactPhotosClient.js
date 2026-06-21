'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { addImpactPhoto, deleteImpactPhoto } from '@/app/actions';
import Image from 'next/image';

export default function ImpactPhotosClient({ initialPhotos }) {
  const [photos, setPhotos] = useState(initialPhotos || []);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'kindera/impact-photos');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

      const result = await addImpactPhoto(uploadData.secure_url, uploadData.public_id);
      if (result.success) {
        setPhotos([result.photo, ...photos]);
        toast.success('Photo uploaded successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this photo? It will be removed from the homepage.')) return;

    setDeletingId(id);
    try {
      const result = await deleteImpactPhoto(id);
      if (result.success) {
        setPhotos(photos.filter(p => p._id !== id));
        toast.success('Photo deleted successfully');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete photo');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Impact Photos</h1>
          <p className="text-gray-500">Add or remove photos from the homepage impact gallery.</p>
        </div>
        <div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Upload Photo</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {photos.length === 0 && !isUploading && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No impact photos found. Upload some to show on the homepage.</p>
          </div>
        )}

        {photos.map((photo) => (
          <Card key={photo._id} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
            <div className="relative aspect-video bg-gray-100">
              <Image
                src={photo.url}
                alt="Impact Photo"
                fill
                className="object-cover"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(photo._id)}
                  disabled={deletingId === photo._id}
                >
                  {deletingId === photo._id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Trash2 className="w-4 h-4 mr-1" /> Delete</>
                  )}
                </Button>
              </div>
            </div>
            <CardContent className="p-3 text-xs text-gray-500">
              Uploaded on {new Date(photo.createdAt).toLocaleDateString()}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
