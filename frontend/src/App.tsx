import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Onboarding from './pages/Onboarding';
import UploadDocuments from './pages/UploadDocuments';
import Status from './pages/Status';
import Companies from './pages/admin/Companies';
import CompanyDetail from './pages/admin/CompanyDetail';

function Nav() {
  return (
    <nav style={{ marginBottom: '1rem' }}>
      <Link to="/onboarding" style={{ marginRight: '1rem' }}>Onboarding</Link>
      <Link to="/upload-documents" style={{ marginRight: '1rem' }}>Upload documents</Link>
      <Link to="/status" style={{ marginRight: '1rem' }}>Status</Link>
      <Link to="/admin/companies">Admin</Link>
    </nav>
  );
}

export default function App() {
  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <Nav />
      <Routes>
        <Route path="/" element={<Navigate to="/onboarding" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/upload-documents" element={<UploadDocuments />} />
        <Route path="/status" element={<Status />} />
        <Route path="/admin/companies" element={<Companies />} />
        <Route path="/admin/companies/:id" element={<CompanyDetail />} />
      </Routes>
    </div>
  );
}
