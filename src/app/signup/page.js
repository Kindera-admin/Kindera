'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { signup } from '@/app/actions';
import { Upload, FileText, X, CheckCircle2, Loader2, Home } from 'lucide-react';

const CERT_TYPES = [
  { key: '12A',          label: '12A Certificate',            desc: 'Tax exemption certificate' },
  { key: '80G',          label: '80G Certificate',            desc: 'Donor tax benefit certificate' },
  { key: 'FCRA',         label: 'FCRA Certificate',           desc: 'Foreign contribution certificate' },
  { key: 'registration', label: 'Registration Certificate',   desc: 'NGO registration document' },
];

function CertUpload({ certKey, label, desc, onFileSelect, file, onRemove }) {
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

function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [certFiles, setCertFiles] = useState({});

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      username: '',
      role: 'volunteer',
      organizationName: '',
      ngoId: '',
      mobile: '',
      password: '',
      confirmPassword: '',
      registrationReason: '',
    },
  });

  const role = watch('role');
  const password = watch('password');

  const handleFileSelect = (key, file) => setCertFiles(prev => ({ ...prev, [key]: file }));
  const handleFileRemove = (key) => setCertFiles(prev => { const n = { ...prev }; delete n[key]; return n; });

  // Upload a single file to Cloudinary via the existing API route
  const uploadFile = async (file, label) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'kindera/ngo-certificates');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`Failed to upload ${label}`);
    const data = await res.json();
    return data.url;
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      // 1. Upload cert files first (if any)
      const uploadedDocs = [];
      for (const ct of CERT_TYPES) {
        const file = certFiles[ct.key];
        if (file) {
          toast.loading(`Uploading ${ct.label}…`, { id: `upload-${ct.key}` });
          const url = await uploadFile(file, ct.label);
          toast.dismiss(`upload-${ct.key}`);
          uploadedDocs.push({ docType: ct.key, label: ct.label, url });
        }
      }

      // 2. Build FormData for signup
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('username', data.username);
      formData.append('role', data.role);
      formData.append('organizationName', data.organizationName);
      if (data.role === 'ngo') formData.append('ngoId', data.ngoId);
      formData.append('mobile', data.mobile);
      formData.append('registrationReason', data.registrationReason);
      formData.append('password', data.password);
      formData.append('confirmPassword', data.confirmPassword);

      // Pass uploaded docs as JSON
      if (uploadedDocs.length > 0) {
        formData.append('documents', JSON.stringify(uploadedDocs));
      }

      const result = await signup(formData);

      if (result.success) {
        toast.success('Account created!', {
          description: uploadedDocs.length > 0
            ? `${uploadedDocs.length} certificate(s) submitted for admin review.`
            : 'Your account is pending admin approval.',
        });
        router.push('/pending');
      } else {
        toast.error('Signup failed', { description: result.message });
      }
    } catch (err) {
      toast.error('Signup failed', { description: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" placeholder="Enter your full name"
            {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Name must be at least 2 characters' } })} />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" placeholder="Choose a username"
            {...register('username', {
              required: 'Username is required',
              minLength: { value: 3, message: 'Username must be at least 3 characters' },
              pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Only letters, numbers, and underscores allowed' },
            })} />
          {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
        </div>

        {/* Role */}
        <div className="space-y-2">
          <Label htmlFor="role">I am registering as an...</Label>
          <Select value={role} onValueChange={(value) => { setValue('role', value); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select a role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="volunteer">Volunteer</SelectItem>
              <SelectItem value="org_spoc">Organisation SPOC</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Are you an NGO?{" "}
            <a
              href="https://forms.gle/T1ACRMV27pDQqvWz8"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 font-semibold hover:underline"
            >
              Fill out this form
            </a>{" "}
            to register with us.
          </p>
        </div>

        {/* Organization / NGO Name */}
        <div className="space-y-2">
          <Label htmlFor="organizationName">{role === 'ngo' ? 'NGO Name' : role === 'volunteer' ? 'Organization Name (Optional)' : 'Organization Name'}</Label>
          <Input id="organizationName"
            placeholder={`Enter your ${role === 'ngo' ? 'NGO name' : 'organization name'}`}
            {...register('organizationName', {
              required: role === 'volunteer' ? false : `${role === 'ngo' ? 'NGO name' : 'Organization name'} is required`,
              minLength: { value: 2, message: 'Must be at least 2 characters' },
            })} />
          {errors.organizationName && <p className="text-sm text-red-500">{errors.organizationName.message}</p>}
        </div>

        {/* NGO ID */}
        {role === 'ngo' && (
          <div className="space-y-2">
            <Label htmlFor="ngoId">NGO ID / Registration Number</Label>
            <Input id="ngoId" placeholder="Enter your NGO registration number"
              {...register('ngoId', { required: 'NGO ID is required for NGO Representatives' })} />
            {errors.ngoId && <p className="text-sm text-red-500">{errors.ngoId.message}</p>}
          </div>
        )}

        {/* Mobile */}
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile Number</Label>
          <Input id="mobile" type="tel" placeholder="Enter your mobile number"
            {...register('mobile', {
              required: 'Mobile number is required',
              pattern: { value: /^[6-9]\d{9}$/, message: 'Enter a valid 10-digit Indian mobile number' },
            })} />
          {errors.mobile && <p className="text-sm text-red-500">{errors.mobile.message}</p>}
        </div>

        {/* Comment / Reason */}
        {role === 'volunteer' && (
          <div className="space-y-2">
            <Label htmlFor="registrationReason">Why are you registering? (Comment for Admin)</Label>
            <Input id="registrationReason" placeholder="I want to volunteer because..."
              {...register('registrationReason', { required: 'Please provide a reason' })} />
            {errors.registrationReason && <p className="text-sm text-red-500">{errors.registrationReason.message}</p>}
          </div>
        )}

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="Create a password"
            {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })} />
          {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input id="confirmPassword" type="password" placeholder="Confirm your password"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === password || 'Passwords do not match',
            })} />
          {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
        </div>

        {/* ── NGO Certificate Upload ── */}
        {role === 'ngo' && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-[1px] flex-1 bg-gray-100" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">NGO Certificates</span>
              <div className="h-[1px] flex-1 bg-gray-100" />
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Upload your NGO certificates for faster admin verification. All fields are optional but at least one is recommended.
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
                {Object.keys(certFiles).length} certificate(s) ready to upload
              </p>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-4 px-4 sm:px-6 pt-2 pb-6">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</span>
          ) : 'Sign Up'}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </p>
      </CardFooter>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <div className="w-full max-w-md mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#0d3b26] transition-colors"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2 pt-6">
          <CardTitle className="text-xl sm:text-2xl">Create Account</CardTitle>
          <CardDescription>Sign up to join Kindera</CardDescription>
        </CardHeader>
        <Suspense fallback={<div className="p-6 text-center">Loading form...</div>}>
          <SignupForm />
        </Suspense>
      </Card>
    </div>
  );
}
