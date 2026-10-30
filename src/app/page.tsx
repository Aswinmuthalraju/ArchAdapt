import PlanSvg from '@/components/canvas/PlanSvg';
import Home from '@/components/marketing/home/Home';
import { showcaseDesign } from '@/components/marketing/HeroPlan';
import MotionPage from '@/components/marketing/site/MotionPage';

export default function LandingPage() {
  // Drawn on the server by the real layout engine, then handed to the client gallery.
  const design = showcaseDesign();
  const plan = design ? (
    <PlanSvg design={design} floor={0} theme="paper" showSite={false} showAnnotations={false} crop className="block h-full w-full" />
  ) : null;
  return (
    <MotionPage>
      <Home plan={plan} />
    </MotionPage>
  );
}
