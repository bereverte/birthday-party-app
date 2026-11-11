// Solo, pair or group, from the number of members.
export function actKind(memberCount: number) {
  if (memberCount <= 1) return '🎤 Solo'
  if (memberCount === 2) return '👯 Parella'
  return '🎉 Grup'
}
