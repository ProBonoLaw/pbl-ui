import LoadingState from '@/components/LoadingState';

export default function LoadingInvestigativeTimeline() {
  return (
    <LoadingState
      title="Loading investigative timeline"
      message="Retrieving the saved Timeline Builder result."
      fullHeight
    />
  );
}
