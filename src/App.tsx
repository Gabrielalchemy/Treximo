import { AnimatePresence, motion } from 'framer-motion'
import { TabBar, type Tab } from './components/TabBar'
import { RecordScreen } from './screens/RecordScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { RunDetailScreen } from './screens/RunDetailScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { routeKey, useRoute, type Route } from './state/router'
import { pageEase, pageVariants } from './motion/variants'

function tabForRoute(r: Route): Tab {
  if (r.name === 'run') return 'history'
  return r.name
}

export default function App() {
  const route = useRoute()
  const key = routeKey(route)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={key}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageEase}
            className="absolute inset-0"
          >
            {route.name === 'record' && <RecordScreen />}
            {route.name === 'history' && <HistoryScreen />}
            {route.name === 'settings' && <SettingsScreen />}
            {route.name === 'run' && <RunDetailScreen id={route.id} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar tab={tabForRoute(route)} onSelect={(t) => (location.hash = `#/${t}`)} />
    </div>
  )
}
