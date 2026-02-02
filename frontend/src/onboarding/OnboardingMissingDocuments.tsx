import { Link } from 'react-router-dom';

interface Props {
  companyName: string;
  missingDocumentTypes: string[];
}

export function OnboardingMissingDocuments({
  companyName,
  missingDocumentTypes,
}: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-stone-900">
          Upload required documents
        </h1>
        <p className="mt-2 text-stone-600">
          {companyName} is missing the following document types. Upload them to
          continue.
        </p>
        <ul className="mt-4 list-inside list-disc text-sm text-stone-600">
          {missingDocumentTypes.map((type) => (
            <li key={type}>{type}</li>
          ))}
        </ul>
        <Link
          to="/onboarding/documents"
          className="mt-6 inline-block rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          Go to upload
        </Link>
      </div>
    </div>
  );
}
