import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
import App from './App'
import Today from './pages/Today'
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
import CycleDetail from './pages/CycleDetail'
import RidePlayer from './pages/RidePlayer'
import Profile from './pages/Profile'
import Progress from './pages/Progress'
import PlanDetail from './pages/PlanDetail'
import { BleProvider } from './BleContext'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Today /> },
      { path: 'train', element: <Train /> },
      { path: 'exercises', element: <Exercises /> },
      { path: 'exercises/:id', element: <ExerciseDetail /> },
      { path: 'workouts', element: <Workouts /> },
      { path: 'workouts/:id', element: <WorkoutDetail /> },
      { path: 'workouts/:id/play', element: <GymPlayer /> },
      { path: 'build', element: <WorkoutBuilder /> },
      { path: 'template/:id/play', element: <GymPlayer /> },
      { path: 'gym-session/play', element: <GymPlayer /> },
      { path: 'plan/:id', element: <PlanDetail /> },
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
      { path: 'cycle/:id', element: <CycleDetail /> },
      { path: 'ride-player', element: <RidePlayer /> },
      { path: 'profile', element: <Profile /> },
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
      <BleProvider>
        <RouterProvider router={router} />
      </BleProvider>
    </StrictMode>,
  )
}
boot()
