import React from 'react';
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/admin/companies" className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Aspire Coworks</h1>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Admin Dashboard</span>
          </div>
        </div>
      </div>
    </header>
  );
}
