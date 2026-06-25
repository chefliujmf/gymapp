import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
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
import Strength from './pages/Strength'
import Logs from './pages/Logs'
import LogActivity from './pages/LogActivity'
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
      { path: 'strength', element: <Strength /> },
      { path: 'logs', element: <Logs /> },
      { path: 'log-activity', element: <LogActivity /> },
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
