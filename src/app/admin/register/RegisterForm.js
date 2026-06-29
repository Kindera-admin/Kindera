'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { registerUser, adminUploadNGODocument } from '@/app/actions';
import { Upload, FileText, X, CheckCircle2, Loader2 } from 'lucide-react';

const CERT_TYPES = [
  { key: '12A',          label: '12A Certificate',          desc: 'Tax exemption certificate' },
  { key: '80G',          label: '80G Certificate',          desc: 'Donor tax benefit certificate' },
  { key: 'FCRA',         label: 'FCRA Certificate',         desc: 'Foreign contribution certificate' },
  { key: 'registration', label: 'Registration Certificate', desc: 'NGO registration document' },
];

function CertUpload({ certKey, label, desc, file, onFileSelect, onRemove }) {
  const ref = useRef(null);
  return (
    <div className={`border rounded-xl p-4 transition-all ${file ? 'border-emerald-300 bg-emerald-50/50' : 'border-dashed border-gray-200 hover:border-gray-300'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${file ? 'bg-emerald-500' : 'bg-gray-100'}`}>
            {file ? <CheckCircle2 className="w-4 h-4 text-white" /> : <FileText className="w-4 h-4 text-gray-400" />}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{label}</p>
            <p className="text-xs text-gray-400">{desc}</p>
            {file && <p className="text-xs text-emerald-600 font-medium mt-0.5 truncate max-w-[180px]">{file.name}</p>}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {file && (
            <button type="button" onClick={onRemove} className="p-1 rounded-lg hover:bg-red-100 transition-colors">
              <X className="w-4 h-4 text-red-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="text-xs font-medium text-[#0d3b26] hover:text-emerald-600 flex items-center gap-1 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            {file ? 'Replace' : 'Upload'}
          </button>
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.doc,.docx,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => { if (e.target.files[0]) onFileSelect(certKey, e.target.files[0]); }}
      />
    </div>
  );
}

export default function RegisterForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState('org_member');
  const [certFiles, setCertFiles] = useState({});

  const { register, handleSubmit, formState: { errors }, setValue } = useForm({
    defaultValues: { username: '', password: '', name: '', ngoId: '', organizationName: '' },
  });

  const handleFileSelect = (key, file) => setCertFiles(prev => ({ ...prev, [key]: file }));
  const handleFileRemove = (key) => setCertFiles(prev => { const n = { ...prev }; delete n[key]; return n; });

  const uploadFile = async (file, label) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'kindera/ngo-certificates');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Failed to upload ${label}`);
    return (await res.json()).url;
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('username', data.username);
      formData.append('password', data.password);
      formData.append('role', selectedRole);
      formData.append('name', data.name);
      if (selectedRole === 'ngo') formData.append('ngoId', data.ngoId);
      if (selectedRole === 'org_spoc' || selectedRole === 'org_member')
        formData.append('organizationName', data.organizationName);

      const result = await registerUser(formData);
      if (!result.success) {
        toast.error('Registration Failed', { description: result.message || 'An error occurred.' });
        return;
      }

      // Upload certificates for NGO users
      if (selectedRole === 'ngo' && Object.keys(certFiles).length > 0) {
        const ngoUserId = result.userId;
        for (const ct of CERT_TYPES) {
          const file = certFiles[ct.key];
          if (!file) continue;
          toast.loading(`Uploading ${ct.label}…`, { id: `upload-${ct.key}` });
          try {
            const url = await uploadFile(file, ct.label);
            await adminUploadNGODocument(ngoUserId, ct.key, ct.label, url);
            toast.dismiss(`upload-${ct.key}`);
          } catch (err) {
            toast.dismiss(`upload-${ct.key}`);
            toast.error(`Failed to upload ${ct.label}`);
          }
        }
      }

      toast.success('User Registered', { description: 'The user has been registered successfully.' });
      router.push('/admin/users');
    } catch {
      toast.error('Registration Failed', { description: 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showOrganizationField = selectedRole === 'org_spoc' || selectedRole === 'org_member';

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Register New User</CardTitle>
        <CardDescription>
          Create a new user account manually, or{' '}
          <a href="/dashboard/team/generate" className="text-[#0d3b26] font-semibold hover:underline">
            bulk generate corporate logins
          </a>.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-5">
          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={(value) => {
              setSelectedRole(value);
              setValue('organizationName', '');
              setValue('ngoId', '');
              setCertFiles({});
            }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="org_spoc">Organisation SPOC</SelectItem>
                <SelectItem value="org_member">Organisation Member</SelectItem>
                <SelectItem value="employee">Employee / Team</SelectItem>
                <SelectItem value="ngo">NGO Representative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{selectedRole === 'ngo' ? 'Representative Name' : 'Full Name'}</Label>
            <Input id="name" className="w-full"
              placeholder={selectedRole === 'ngo' ? 'NGO representative full name' : 'Full name'}
              {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" className="w-full" {...register('username', { required: 'Username is required' })} />
            {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" className="w-full"
              {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })} />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          {/* NGO ID */}
          {selectedRole === 'ngo' && (
            <div className="space-y-2">
              <Label htmlFor="ngoId">NGO ID / Registration Number</Label>
              <Input id="ngoId" className="w-full" placeholder="NGO registration number"
                {...register('ngoId', { required: 'NGO ID is required for NGO users' })} />
              {errors.ngoId && <p className="text-sm text-red-500">{errors.ngoId.message}</p>}
            </div>
          )}

          {/* Organisation Name */}
          {showOrganizationField && (
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organisation Name</Label>
              <Input id="organizationName" className="w-full" placeholder="Enter organisation name"
                {...register('organizationName', { required: showOrganizationField ? 'Organisation name is required' : false })} />
              {errors.organizationName && <p className="text-sm text-red-500">{errors.organizationName.message}</p>}
            </div>
          )}

          {/* Certificate Upload for NGO */}
          {selectedRole === 'ngo' && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-[1px] flex-1 bg-gray-100" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">NGO Certificates</span>
                <div className="h-[1px] flex-1 bg-gray-100" />
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Admin-uploaded certificates are automatically marked as verified.
              </p>
              <div className="space-y-3">
                {CERT_TYPES.map(ct => (
                  <CertUpload
                    key={ct.key}
                    certKey={ct.key}
                    label={ct.label}
                    desc={ct.desc}
                    file={certFiles[ct.key]}
                    onFileSelect={handleFileSelect}
                    onRemove={() => handleFileRemove(ct.key)}
                  />
                ))}
              </div>
              {Object.keys(certFiles).length > 0 && (
                <p className="text-xs text-emerald-600 font-medium mt-3 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {Object.keys(certFiles).length} certificate(s) will be uploaded and auto-verified
                </p>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? (
              <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Registering...</span>
            ) : 'Register User'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}