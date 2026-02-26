/**
 * groupManager.js
 * Group and Community management helpers
 */

// ── Create group ─────────────────────────────────────────────────────────────
export async function createGroup(sock, subject, participantJids = []) {
  return sock.groupCreate(subject, participantJids)
}

// ── Get group metadata ───────────────────────────────────────────────────────
export async function getGroupInfo(sock, jid) {
  return sock.groupMetadata(jid)
}

// ── Get all participating groups ─────────────────────────────────────────────
export async function getAllGroups(sock) {
  return sock.groupFetchAllParticipating()
}

// ── Update group subject ─────────────────────────────────────────────────────
export async function updateGroupSubject(sock, jid, subject) {
  return sock.groupUpdateSubject(jid, subject)
}

// ── Update group description ─────────────────────────────────────────────────
export async function updateGroupDescription(sock, jid, description) {
  return sock.groupUpdateDescription(jid, description)
}

// ── Add participants ─────────────────────────────────────────────────────────
export async function addParticipants(sock, jid, participants) {
  return sock.groupParticipantsUpdate(jid, participants, 'add')
}

// ── Remove participants ──────────────────────────────────────────────────────
export async function removeParticipants(sock, jid, participants) {
  return sock.groupParticipantsUpdate(jid, participants, 'remove')
}

// ── Promote to admin ─────────────────────────────────────────────────────────
export async function promoteParticipants(sock, jid, participants) {
  return sock.groupParticipantsUpdate(jid, participants, 'promote')
}

// ── Demote from admin ────────────────────────────────────────────────────────
export async function demoteParticipants(sock, jid, participants) {
  return sock.groupParticipantsUpdate(jid, participants, 'demote')
}

// ── Get invite link ──────────────────────────────────────────────────────────
export async function getInviteLink(sock, jid) {
  const code = await sock.groupInviteCode(jid)
  return code ? `https://chat.whatsapp.com/${code}` : null
}

// ── Revoke invite link ───────────────────────────────────────────────────────
export async function revokeInviteLink(sock, jid) {
  const code = await sock.groupRevokeInvite(jid)
  return code ? `https://chat.whatsapp.com/${code}` : null
}

// ── Join via invite code ─────────────────────────────────────────────────────
export async function joinGroup(sock, inviteCode) {
  return sock.groupAcceptInvite(inviteCode)
}

// ── Leave group ──────────────────────────────────────────────────────────────
export async function leaveGroup(sock, jid) {
  return sock.groupLeave(jid)
}

// ── Toggle ephemeral (disappearing) messages ─────────────────────────────────
export async function setGroupEphemeral(sock, jid, seconds = 604800) {
  return sock.groupToggleEphemeral(jid, seconds)
}

// ── Change group settings ────────────────────────────────────────────────────
// setting: 'announcement' (only admins) | 'not_announcement' | 'locked' | 'unlocked'
export async function updateGroupSetting(sock, jid, setting) {
  return sock.groupSettingUpdate(jid, setting)
}

// ── Member add mode ──────────────────────────────────────────────────────────
// mode: 'admin_add' | 'all_member_add'
export async function setMemberAddMode(sock, jid, mode) {
  return sock.groupMemberAddMode(jid, mode)
}

// ── Join approval mode ───────────────────────────────────────────────────────
// mode: 'on' | 'off'
export async function setJoinApprovalMode(sock, jid, mode) {
  return sock.groupJoinApprovalMode(jid, mode)
}

// ── Get join request list ────────────────────────────────────────────────────
export async function getJoinRequests(sock, jid) {
  return sock.groupRequestParticipantsList(jid)
}

// ── Approve/reject join requests ─────────────────────────────────────────────
export async function handleJoinRequests(sock, jid, participants, action) {
  return sock.groupRequestParticipantsUpdate(jid, participants, action)
}
