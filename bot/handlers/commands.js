/**
 * commands.js
 * Text command handler — prefix: !
 * All commands usable by sending a WhatsApp message to the bot
 */
import {
  sendText, sendImage, sendVideo, sendGif, sendAudio, sendVoiceNote,
  sendDocument, sendLocation, sendContact, sendPoll, sendMultiPoll,
  sendButtons, sendList, sendCTAUrl, sendCTACall, sendCTACopy,
  sendButtonsWithImage, sendCarousel, sendAlbum, sendViewOnce,
  enableDisappearing, disableDisappearing, forwardMessage,
  deleteMessage, editMessage, pinMessage, unpinMessage, sendEvent,
  sendReaction,
} from '../features/sendExamples.js'
import { getGroupInfo, getInviteLink, promoteParticipants, removeParticipants, updateGroupSetting } from '../features/groupManager.js'
import { registerPoll } from '../features/pollManager.js'
import { extractText } from '../features/mediaHandler.js'

const HELP_TEXT = `*🤖 Bot Commands*

*📨 Messages*
!ping — pong test
!echo <text> — echo back
!mention <number> — mention someone

*📎 Media*
!image — send image
!video — send video
!gif — send GIF
!audio — send audio
!voice — send voice note
!doc — send document
!sticker — sticker info

*📍 Other Content*
!location — send location
!contact — send contact card
!viewonce — send view-once image
!album — send photo album
!event — send event message

*🗳️ Polls*
!poll — single-choice poll
!multipoll — multi-choice poll

*🔘 Interactive*
!buttons — quick reply buttons
!list — interactive list menu
!urlbtn — CTA URL button
!callbtn — CTA call button
!copybtn — CTA copy/code button
!imgbtn — buttons with image
!carousel — carousel cards

*💬 Message Actions*
!react — react 👍 to quoted msg
!unreact — remove reaction from quoted
!delete — delete quoted message
!edit <text> — edit quoted message
!pin — pin quoted message
!unpin — unpin quoted message
!forward — forward quoted message

*⚙️ Chat Settings*
!disappear on — enable disappearing (7d)
!disappear off — disable disappearing
!read — mark chat as read
!typing — send typing indicator

*👥 Groups (in a group chat)*
!groupinfo — group metadata
!invite — get invite link
!announce — only admins can send
!unannounce — everyone can send
!lock — lock group info
!unlock — unlock group info
!promote <@mention> — promote to admin
!kick <@mention> — remove member

*🔒 Privacy & Profile*
!privacy — view privacy settings
!status <text> — update status
!block <jid> — block a JID

*ℹ️ Info*
!help — this message
!me — bot info`

export async function handleCommand(sock, msg, io) {
  const jid = msg.key.remoteJid
  const text = extractText(msg)
  if (!text || !text.startsWith('!')) return false

  const [cmd, ...args] = text.slice(1).trim().split(' ')
  const command = cmd.toLowerCase()
  const arg = args.join(' ').trim()
  const quoted = msg  // use this message as the quoted context

  try {
    switch (command) {
      // ── Basic ─────────────────────────────────────────────────────────────
      case 'ping':
        await sendText(sock, jid, '🏓 Pong! Bot is alive.')
        break

      case 'help':
        await sendText(sock, jid, HELP_TEXT)
        break

      case 'echo':
        await sendText(sock, jid, arg || '(empty)')
        break

      case 'me':
        await sendText(sock, jid, `*Bot Info*\nJID: ${sock.user?.id}\nName: ${sock.user?.name}`)
        break

      case 'mention': {
        const num = arg.replace(/[^0-9]/g, '')
        if (num) await sock.sendMessage(jid, {
          text: `Hey @${num}! 👋`,
          mentions: [`${num}@s.whatsapp.net`],
        })
        else await sendText(sock, jid, 'Usage: !mention <phone number>')
        break
      }

      // ── Media ─────────────────────────────────────────────────────────────
      case 'image': await sendImage(sock, jid); break
      case 'video': await sendVideo(sock, jid); break
      case 'gif':   await sendGif(sock, jid); break
      case 'audio': await sendAudio(sock, jid); break
      case 'voice': await sendVoiceNote(sock, jid); break
      case 'doc':   await sendDocument(sock, jid); break
      case 'sticker': await sendText(sock, jid, '🎭 Sticker: send a .webp file directly as a sticker.'); break
      case 'viewonce':
        await sendText(sock, jid, '⏳ Sending view-once image...')
        await sendViewOnce(sock, jid)
        break
      case 'album': await sendAlbum(sock, jid); break
      case 'event': await sendEvent(sock, jid); break

      // ── Location & Contact ────────────────────────────────────────────────
      case 'location': await sendLocation(sock, jid); break
      case 'contact':  await sendContact(sock, jid); break

      // ── Polls ─────────────────────────────────────────────────────────────
      case 'poll': {
        const pollMsg = await sendPoll(sock, jid)
        if (pollMsg) registerPoll(pollMsg)
        break
      }
      case 'multipoll': {
        const pollMsg = await sendMultiPoll(sock, jid)
        if (pollMsg) registerPoll(pollMsg)
        break
      }

      // ── Interactive ───────────────────────────────────────────────────────
      case 'buttons':   await sendButtons(sock, jid); break
      case 'list':      await sendList(sock, jid); break
      case 'urlbtn':    await sendCTAUrl(sock, jid, arg || 'https://github.com'); break
      case 'callbtn':   await sendCTACall(sock, jid); break
      case 'copybtn':   await sendCTACopy(sock, jid); break
      case 'imgbtn':    await sendButtonsWithImage(sock, jid); break
      case 'carousel':  await sendCarousel(sock, jid); break

      // ── Message Actions ───────────────────────────────────────────────────
      case 'react':
        await sendReaction(sock, jid, quoted.key, '👍')
        break
      case 'unreact':
        await sock.sendMessage(jid, { react: { text: '', key: quoted.key } })
        break
      case 'delete':
        await deleteMessage(sock, jid, quoted.key)
        break
      case 'edit':
        await editMessage(sock, jid, quoted.key, arg || 'Edited message ✏️')
        break
      case 'pin':
        await pinMessage(sock, jid, quoted.key)
        await sendText(sock, jid, '📌 Message pinned!')
        break
      case 'unpin':
        await unpinMessage(sock, jid, quoted.key)
        break
      case 'forward':
        await forwardMessage(sock, jid, quoted)
        break

      // ── Chat Settings ─────────────────────────────────────────────────────
      case 'disappear':
        if (arg === 'on') await enableDisappearing(sock, jid)
        else if (arg === 'off') await disableDisappearing(sock, jid)
        else await sendText(sock, jid, 'Usage: !disappear on/off')
        break

      case 'read':
        await sock.readMessages([msg.key])
        await sendText(sock, jid, '✅ Marked as read')
        break

      case 'typing':
        await sock.sendPresenceUpdate('composing', jid)
        await new Promise(r => setTimeout(r, 2000))
        await sock.sendPresenceUpdate('paused', jid)
        break

      // ── Group Commands ────────────────────────────────────────────────────
      case 'groupinfo': {
        if (!jid.endsWith('@g.us')) { await sendText(sock, jid, 'Only works in groups'); break }
        const meta = await getGroupInfo(sock, jid)
        const info = [
          `*Group Info*`,
          `Name: ${meta.subject}`,
          `ID: ${meta.id}`,
          `Members: ${meta.participants?.length || 0}`,
          `Admins: ${meta.participants?.filter(p => p.admin).length || 0}`,
          `Created: ${new Date((meta.creation || 0) * 1000).toLocaleDateString()}`,
          `Description: ${meta.desc || 'None'}`,
        ].join('\n')
        await sendText(sock, jid, info)
        break
      }

      case 'invite': {
        if (!jid.endsWith('@g.us')) { await sendText(sock, jid, 'Only works in groups'); break }
        const link = await getInviteLink(sock, jid)
        await sendText(sock, jid, link ? `🔗 Invite link:\n${link}` : '❌ Could not get invite link (need admin)')
        break
      }

      case 'announce': {
        if (!jid.endsWith('@g.us')) break
        await updateGroupSetting(sock, jid, 'announcement')
        await sendText(sock, jid, '📢 Group is now in announcement mode (only admins can send)')
        break
      }

      case 'unannounce': {
        if (!jid.endsWith('@g.us')) break
        await updateGroupSetting(sock, jid, 'not_announcement')
        await sendText(sock, jid, '💬 All members can now send messages')
        break
      }

      case 'lock': {
        if (!jid.endsWith('@g.us')) break
        await updateGroupSetting(sock, jid, 'locked')
        await sendText(sock, jid, '🔒 Group info locked (only admins can edit)')
        break
      }

      case 'unlock': {
        if (!jid.endsWith('@g.us')) break
        await updateGroupSetting(sock, jid, 'unlocked')
        await sendText(sock, jid, '🔓 Group info unlocked')
        break
      }

      case 'promote': {
        if (!jid.endsWith('@g.us')) break
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        if (!mentioned.length) { await sendText(sock, jid, 'Usage: !promote @mention'); break }
        await promoteParticipants(sock, jid, mentioned)
        await sendText(sock, jid, `⬆️ Promoted ${mentioned.length} member(s) to admin`)
        break
      }

      case 'kick': {
        if (!jid.endsWith('@g.us')) break
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        if (!mentioned.length) { await sendText(sock, jid, 'Usage: !kick @mention'); break }
        await removeParticipants(sock, jid, mentioned)
        await sendText(sock, jid, `👋 Removed ${mentioned.length} member(s)`)
        break
      }

      // ── Privacy ───────────────────────────────────────────────────────────
      case 'privacy': {
        const settings = await sock.fetchPrivacySettings(true)
        const text = Object.entries(settings).map(([k, v]) => `${k}: ${v}`).join('\n')
        await sendText(sock, jid, `*Privacy Settings*\n${text}`)
        break
      }

      case 'status': {
        if (!arg) { await sendText(sock, jid, 'Usage: !status <text>'); break }
        await sock.updateProfileStatus(arg)
        await sendText(sock, jid, `✅ Status updated to: "${arg}"`)
        break
      }

      case 'block': {
        if (!arg) { await sendText(sock, jid, 'Usage: !block <jid>'); break }
        await sock.updateBlockStatus(arg, 'block')
        await sendText(sock, jid, `🚫 Blocked: ${arg}`)
        break
      }

      default:
        // Unknown command — ignore silently
        return false
    }
    return true
  } catch (e) {
    console.error(`Command !${command} error:`, e.message)
    await sendText(sock, jid, `❌ Error: ${e.message}`)
    return true
  }
}
