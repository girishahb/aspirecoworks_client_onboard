import { Link } from 'react-router-dom';

const COMPANY_NAME = 'ASPIRE COWORKS';

interface LogoProps {
  /** Link destination (e.g. "/" or "/admin/dashboard"). No link if undefined. */
  to?: string;
  /** Optional class for the wrapper. */
  className?: string;
  /** Logo image path (default: /logo.png). */
  logoSrc?: string;
}

/**
 * Logo + company name for header. Brand: Arial Bold #134b7f.
 */
export default function Logo({ to = '/', className = '', logoSrc = '/logo.png' }: LogoProps) {
  const content = (
    <>
      <img
        src={logoSrc}
        alt="ASPIRE COWORKS logo"
        className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10 md:h-11 md:w-11"
        width={44}
        height={44}
        loading="eager"
      />
      <span
        className="font-bold whitespace-nowrap text-base sm:text-lg md:text-xl"
        style={{
          fontFamily: 'Arial, "Segoe UI", system-ui, sans-serif',
          color: '#134b7f',
          letterSpacing: '0.02em',
        }}
      >
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
