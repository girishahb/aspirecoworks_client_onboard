import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../api/client';
import type { AdminCompany } from '../../api/types';
import DashboardLayout from '../../components/layout/DashboardLayout';
import PageHeader from '../../components/layout/PageHeader';
import DataTable from '../../components/table/DataTable';
import FilterPanel from '../../components/filters/FilterPanel';
import SearchInput from '../../components/filters/SearchInput';
import StatusFilter from '../../components/filters/StatusFilter';
import DateRangeFilter from '../../components/filters/DateRangeFilter';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

export default function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        const list = await apiGet<AdminCompany[]>('/companies');
        if (!cancelled) {
          setCompanies(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load companies');
          setCompanies([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCompanies = useMemo(() => {
    let filtered = companies;

    // Filter by status (default to PENDING if no filter selected)
    if (statusFilter) {
      filtered = filtered.filter((c) => c.onboardingStatus === statusFilter);
    } else {
      // Default: show PENDING companies
      filtered = filtered.filter((c) => c.onboardingStatus === 'PENDING');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.companyName.toLowerCase().includes(query) ||
          c.contactEmail.toLowerCase().includes(query)
      );
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter((c) => {
        const createdDate = new Date(c.createdAt);
        return createdDate >= new Date(startDate);
      });
    }
    if (endDate) {
      filtered = filtered.filter((c) => {
        const createdDate = new Date(c.createdAt);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return createdDate <= end;
      });
    }

    return filtered;
  }, [companies, searchQuery, statusFilter, startDate, endDate]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  }

  function handleClearFilters() {
    setSearchQuery('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
  }

  const columns = [
    {
      key: 'companyName',
      header: 'Company Name',
    },
    {
      key: 'contactEmail',
      header: 'Contact Email',
    },
    {
      key: 'onboardingStatus',
      header: 'Status',
      render: (company: AdminCompany) => <Badge status={company.onboardingStatus} />,
    },
    {
      key: 'createdAt',
      header: 'Created Date',
      render: (company: AdminCompany) => formatDate(company.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (company: AdminCompany) => (
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/companies/${company.id}`);
          }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Companies"
        breadcrumbs={[{ label: 'Admin', path: '/admin/companies' }, { label: 'Companies' }]}
      />

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-1">
          <FilterPanel onClear={handleClearFilters}>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search companies..."
            />
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </FilterPanel>
        </div>

        <div className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredCompanies.length} of {companies.length} companies
            </p>
          </div>

          <DataTable
            columns={columns}
            data={filteredCompanies}
            loading={loading}
            emptyMessage="No companies found. Try adjusting your filters."
            onRowClick={(company) => navigate(`/admin/companies/${company.id}`)}
            keyExtractor={(company) => company.id}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
