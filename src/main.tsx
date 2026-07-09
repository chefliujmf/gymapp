import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'

// Keep the PWA fresh. Two halves had to BOTH work or an installed app stayed on the old
// bundle after a deploy (#200 stale login, #217 stale workout chart):
//  1) DETECTION — re-check for a new service worker on focus / online / hourly (not just first load).
//  2) RELOAD — when the new SW takes control, the already-loaded page is still running the OLD
//     JS until it reloads. skipWaiting+clientsClaim activate the new SW, but nothing reloaded the
//     page. This controllerchange handler does — but ONLY on a real update (a controller already
//     existed), so a first install's clientsClaim doesn't trigger a needless reload.
if ('serviceWorker' in navigator) {
  let reloading = false
  const hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return
    reloading = true
    window.location.reload()
  })
}
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (!r) return
    const check = () => { r.update().catch(() => {}) }
    setInterval(check, 30 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    window.addEventListener('online', check)
  },
})
// #370 — expose the PWA updater so the desktop "Refresh" button can pull a newer bundle (if one's
// waiting) before reloading, not just re-run the cached one.
;(window as unknown as { __pwaUpdate?: (reload?: boolean) => Promise<void> }).__pwaUpdate = updateSW
import App from './App'
import Today from './pages/Today'
import Admin from './pages/Admin'
import Train from './pages/Train'
import Workouts from './pages/Workouts'
import WorkoutDetail from './pages/WorkoutDetail'
import GymPlayer from './pages/GymPlayer'
import Exercises from './pages/Exercises'
import ExerciseDetail from './pages/ExerciseDetail'
import WorkoutBuilder from './pages/WorkoutBuilder'
import Programs from './pages/Programs'
import ProgramDetail from './pages/ProgramDetail'
import Trainers from './pages/Trainers'
import TrainerDetail from './pages/TrainerDetail'
import Eat from './pages/Eat'
import Recipes from './pages/Recipes'
import RecipeDetail from './pages/RecipeDetail'
import Mind from './pages/Mind'
import MindDetail from './pages/MindDetail'
import Cycle from './pages/Cycle'
import Run from './pages/Run'
import RideBuilder from './pages/RideBuilder'
import Calendar from './pages/Calendar'
import CycleDetail from './pages/CycleDetail'
import RidePlayer from './pages/RidePlayer'
import RunPlayer from './pages/RunPlayer'
import Profile from './pages/Profile'
import AthleteProfile from './pages/AthleteProfile'
import Settings from './pages/Settings'
import Fitness from './pages/Fitness'
import Wellness from './pages/Wellness'
import MindStats from './pages/MindStats'
import CyclingStats from './pages/CyclingStats'
import RunningStats from './pages/RunningStats'
import Strength from './pages/Strength'
import Logs from './pages/Logs'
import LogActivity from './pages/LogActivity'
import ActivityDetail from './pages/ActivityDetail'
import RecoveryDetail from './pages/RecoveryDetail'
import ReviewPage from './pages/ReviewPage'
import AuditLog from './pages/AuditLog'
import { TrainHub, StatsHub, MoreHub } from './pages/hubs'
import Chat from './pages/Chat'
import Progress from './pages/Progress'
import PlanDetail from './pages/PlanDetail'
import CoachPlanDetail from './pages/CoachPlanDetail'
import PostWorkout from './pages/PostWorkout'
import { BleProvider } from './BleContext'
import { AuthProvider, Gate } from './auth/AuthContext'
import EnvBadge from './EnvBadge'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Today /> },
      { path: 'plan', element: <Calendar /> },
      { path: 'train', element: <TrainHub /> },
      { path: 'gym', element: <Train /> },
      { path: 'stats', element: <StatsHub /> },
      { path: 'more', element: <MoreHub /> },
      { path: 'exercises', element: <Exercises /> },
      { path: 'exercises/:id', element: <ExerciseDetail /> },
      { path: 'workouts', element: <Workouts /> },
      { path: 'workouts/:id', element: <WorkoutDetail /> },
      { path: 'workouts/:id/play', element: <GymPlayer /> },
      { path: 'build', element: <WorkoutBuilder /> },
      { path: 'admin', element: <Admin /> },
      { path: 'chat', element: <Chat /> },
      { path: 'template/:id/play', element: <GymPlayer /> },
      { path: 'gym-session/play', element: <GymPlayer /> },
      { path: 'plan/:id', element: <PlanDetail /> },
      { path: 'coach/:id', element: <CoachPlanDetail /> },
      { path: 'feedback/:id', element: <PostWorkout /> },
      { path: 'programs', element: <Programs /> },
      { path: 'programs/:id', element: <ProgramDetail /> },
      { path: 'trainers', element: <Trainers /> },
      { path: 'trainers/:id', element: <TrainerDetail /> },
      { path: 'eat', element: <Eat /> },
      { path: 'recipes', element: <Recipes /> },
      { path: 'recipes/:id', element: <RecipeDetail /> },
      { path: 'mind', element: <Mind /> },
      { path: 'mind/:id', element: <MindDetail /> },
      { path: 'recovery/:id', element: <RecoveryDetail /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'cycle', element: <Cycle /> },
      { path: 'run', element: <Run /> },
      { path: 'ride-builder', element: <RideBuilder sport="ride" /> },
      { path: 'run-builder', element: <RideBuilder sport="run" /> },
      { path: 'cycle/:id', element: <CycleDetail /> },
      { path: 'ride-player', element: <RidePlayer /> },
      { path: 'run-player', element: <RunPlayer /> },
      { path: 'profile', element: <Profile /> },
      { path: 'profile/athlete', element: <AthleteProfile /> },
      { path: 'settings', element: <Settings /> },
      { path: 'fitness', element: <Fitness /> },
      { path: 'wellness', element: <Wellness /> },
      { path: 'mind-stats', element: <MindStats /> },
      { path: 'cycling-stats', element: <CyclingStats /> },
      { path: 'running-stats', element: <RunningStats /> },
      { path: 'strength', element: <Strength /> },
      { path: 'logs', element: <Logs /> },
      { path: 'log-activity', element: <LogActivity /> },
      { path: 'activity/:id', element: <ActivityDetail /> },
      { path: 'activity-log', element: <AuditLog /> },
      { path: 'progress', element: <Progress /> },
    ],
  },
])

// Dev convenience: auto-connect intervals.icu from the gitignored .env.local so
// you don't have to paste the key. Never present in a deploy build (no .env.local).
async function boot() {
  const { getSetting, setSetting } = await import('./db')
  const key = import.meta.env.VITE_ICU_KEY
  if (import.meta.env.DEV && key && !(await getSetting('icu_api_key'))) {
    await setSetting('icu_api_key', key)
    await setSetting('icu_athlete_id', import.meta.env.VITE_ICU_ATHLETE || 'i28814')
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <EnvBadge />
        <Gate>
          <BleProvider>
            <RouterProvider router={router} />
          </BleProvider>
        </Gate>
      </AuthProvider>
    </StrictMode>,
  )
}
boot()
