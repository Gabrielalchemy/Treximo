import { AnimatePresence, motion } from 'framer-motion'
import { TabBar, type Tab } from './components/TabBar'
import { RecordScreen } from './screens/RecordScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { StatsScreen } from './screens/StatsScreen'
import { RunDetailScreen } from './screens/RunDetailScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { routeKey, useRoute, type Route } from './state/router'
import { pageEase, pageVariants } from './motion/variants'

function tabForRoute(r: Route): Tab {
  if (r.name === 'run') return 'history'
  return r.name
}export default function App() {
  const route = useRoute()
  const key = routeKey(route)

  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-[linear-gradient(180deg,#0a1024_0%,#0e1834_100%)] shadow-[0_30px_80px_rgba(9,14,30,0.42)] ring-1 ring-white/5">
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageEase}
            className="absolute inset-0 px-4"
          >
            {route.name === 'record' && <RecordScreen />}
            {route.name === 'history' && <HistoryScreen />}
            {route.name === 'stats' && <StatsScreen />}
            {route.name === 'settings' && <SettingsScreen />}
            {route.name === 'run' && <RunDetailScreen id={route.id} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <div className="px-2 pb-1.5">
        <TabBar tab={tabForRoute(route)} onSelect={(t) => (location.hash = `#/${t}`)} />
      </div>
    </div>
  )
}
