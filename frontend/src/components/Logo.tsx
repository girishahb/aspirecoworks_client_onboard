import { Link } from 'react-router-dom';

const COMPANY_NAME = 'Aspire Coworks';

interface LogoProps {
  /** Link destination (e.g. "/" or "/admin/dashboard"). No link if undefined. */
  to?: string;
  /** Optional class for the wrapper. */
  className?: string;
  /** Logo image path (default: /logo.svg). Replace with your logo from the PDF export. */
  logoSrc?: string;
}

/**
 * Logo + company name for header. Responsive sizing.
 * Replace public/logo.svg with your Aspire Coworks logo (export from PDF as SVG or PNG).
 */
export default function Logo({ to = '/', className = '', logoSrc = '/logo.svg' }: LogoProps) {
  const content = (
    <>
      <img
        src={logoSrc}
        alt=""
        className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9 md:h-10 md:w-10"
        width={40}
        height={40}
        loading="eager"
      />
      <span className="font-semibold text-text text-base sm:text-lg md:text-xl whitespace-nowrap">
        {COMPANY_NAME}
      </span>
    </>
  );

  const wrapperClass = `inline-flex items-center gap-2 ${className}`.trim();

  if (to) {
    return (
      <Link to={to} className={wrapperClass} aria-label={`${COMPANY_NAME} home`}>
        {content}
      </Link>
    );
  }

  return <span className={wrapperClass}>{content}</span>;
}
