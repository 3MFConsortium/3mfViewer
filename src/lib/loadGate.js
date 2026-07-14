export const createLoadGate = () => {
  let generation = 0
  return {
    begin: () => {
      generation += 1
      return generation
    },
    cancel: () => {
      generation += 1
    },
    isCurrent: (requestId) => requestId === generation,
  }
}
