import { Routes, Route, Navigate } from 'react-router-dom';
import Onboarding from './pages/Onboarding';
import UploadDocuments from './pages/UploadDocuments';
import Status from './pages/Status';
import Companies from './pages/admin/Companies';
import CompanyDetail from './pages/admin/CompanyDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/onboarding" replace />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/upload-documents" element={<UploadDocuments />} />
      <Route path="/status" element={<Status />} />
      <Route path="/admin/companies" element={<Companies />} />
      <Route path="/admin/companies/:id" element={<CompanyDetail />} />
    </Routes>
  );
}
