import InvestimentosPage from '../components/investimentos/InvestimentosPage.jsx';

export default function Investimentos({ session, profile }) {
  return <InvestimentosPage casalCode={profile?.casal_code} />;
}
