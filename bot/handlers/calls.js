/**
 * calls.js
 * Handle incoming calls — log and optionally auto-reject
 */

export async function onCall(sock, calls, io, autoReject = false) {
  for (const call of calls) {
    const info = {
      id: call.id,
      from: call.from,
      callerPn: call.callerPn,
      isVideo: call.isVideo,
      isGroup: call.isGroup,
      status: call.status,
      date: call.date,
    }

    console.log(`📞 Call event: ${call.status} from ${call.from} (${call.isVideo ? 'video' : 'audio'})`)
    io?.emit('call', info)

    // Auto-reject incoming offer calls
    if (autoReject && call.status === 'offer') {
      try {
        await sock.rejectCall(call.id, call.from)
        console.log(`Call rejected: ${call.id}`)
      } catch (e) {
        console.error('Reject call error:', e.message)
      }
    }
  }
}
