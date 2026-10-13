'use client';

import { useState, useTransition } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { importNGOPartners } from '@/app/actions';
import CompanyCheckboxList from './CompanyCheckboxList';

const MAX_ROWS = 500;
const COLUMNS = ['name', 'description', 'focusAreas', 'programs', 'impact', 'registeredOffice', 'location', 'website'];
const byLowerName = Object.fromEntries(COLUMNS.map((c) => [c.toLowerCase(), c]));

// "Focus Areas", "focus_areas" and "FOCUSAREAS" all mean focusAreas.
function canonicalKey(header) {
  return byLowerName[String(header).toLowerCase().replace(/[\s_-]+/g, '')] || null;
}

function toImportRow(raw) {
  const row = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = canonicalKey(header);
    if (key && row[key] === undefined) row[key] = value === null || value === undefined ? '' : String(value);
  }
  return row;
}

// Staff pick companies (none = public partners), choose an .xlsx file and import it.
export default function ImportPanel({ companyOptions, onImported, onClose }) {
  const [companyIds, setCompanyIds] = useState([]);
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [isPending, startTransition] = useTransition();

  const handleImport = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select an Excel file');
      return;
    }
    setResult(null);

    let rows;
    let sheetRows;
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      // blankrows keeps row positions, so a skipped row can be reported by its Excel row number.
      const data = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '', blankrows: true });
      rows = [];
      sheetRows = [];
      data.forEach((raw, index) => {
        const row = toImportRow(raw);
        if (Object.values(row).every((v) => v.trim() === '')) return;
        rows.push(row);
        sheetRows.push(index + 2); // row 1 is the header
      });
    } catch {
      toast.error('Error parsing Excel file');
      return;
    }

    if (rows.length === 0) {
      toast.error('No rows found. The first row must have headers such as "name" and "description".');
      return;
    }
    if (rows.length > MAX_ROWS) {
      toast.error(`The sheet has ${rows.length} rows. Import at most ${MAX_ROWS} at a time.`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await importNGOPartners(rows, JSON.stringify(companyIds));
        const skipped = (res.skipped || []).map((s) => ({ row: sheetRows[s.row - 1] ?? s.row, reason: s.reason }));
        if (res.success) {
          const summary = `Created ${res.created}, skipped ${skipped.length}`;
          if (skipped.length > 0) toast.warning(summary);
          else toast.success(summary);
          setResult({ created: res.created, skipped });
          if (res.created > 0) await onImported();
        } else {
          toast.error(res.message);
          if (skipped.length > 0) setResult({ created: 0, skipped });
        }
      } catch {
        toast.error('Failed to import NGO partners');
      }
    });
  };

  return (
    <form onSubmit={handleImport} className="border rounded-xl p-5 mb-6 bg-gray-50 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-600">Import from Excel</h2>
        <Button type="button" variant="outline" className="hit-target h-11" onClick={onClose}>Close</Button>
      </div>

      <CompanyCheckboxList
        legend="Companies"
        hint="Every imported NGO is added for the companies you tick. Leave all unticked to import public partners."
        options={companyOptions}
        selected={companyIds}
        onChange={setCompanyIds}
      />

      <div className="space-y-1">
        <Label htmlFor="ngo-import-file">Excel file (.xlsx)</Label>
        <Input
          id="ngo-import-file"
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
          className="h-auto min-h-11 py-1.5 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
        />
        <p className="text-xs text-gray-500">
          First row = headers: {COLUMNS.join(', ')}. <span className="font-medium">name</span> and <span className="font-medium">description</span> are required. Separate several programs with semicolons. Up to {MAX_ROWS} rows.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="hit-target h-11" disabled={isPending || !file}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
          {isPending ? 'Importing...' : 'Import'}
        </Button>
      </div>

      {result && (
        <div role="status" className="rounded-md border bg-white p-3 text-sm">
          <p className="font-medium">Created {result.created}, skipped {result.skipped.length}</p>
          {result.skipped.length > 0 && (
            <>
              <p className="mt-2 text-xs text-gray-500">Skipped rows (Excel row numbers):</p>
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-700">
                {result.skipped.map((s) => (
                  <li key={`${s.row}-${s.reason}`}>Row {s.row}: {s.reason}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}
