import AdminCreateCompany from './AdminCreateCompany';

export default function AggregatorCreateCompany() {
  return (
    <AdminCreateCompany
      lockChannel="AGGREGATOR"
      backPath="/aggregator/dashboard"
      detailPathPrefix="/aggregator/companies"
    />
  );
}
