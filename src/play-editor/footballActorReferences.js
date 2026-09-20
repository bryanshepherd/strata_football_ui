import { isFootballHurryDefender } from '../utils/footballPassDefense';

const copy = value => JSON.parse(JSON.stringify(value));
const get = (value, path) => path.reduce((current, key) => current?.[key], value);
const set = (value, path, next) => {
  let parent = value;
  path.slice(0, -1).forEach(key => { parent = parent[key] ??= {}; });
  parent[path.at(-1)] = next;
};
const idAt = (event, reference) => {
  const value = get(event, reference.path);
  if (reference.actor && typeof reference.path.at(-1) === 'number' && value?.role !== reference.role) return null;
  return reference.actor ? value?.playerId || null : value || null;
};
const actor = (slot, role = slot) => ({ path: ['participants', slot], actor: true, role });
const resultId = (section, field) => ({ path: ['result', section, field] });

// References describe one role, not every occurrence of the same player. A
// player's separate lateral, tackle, or fumble role must not be reassigned.
const referenceGroups = event => {
  const groups = [];
  if (event.type === 'punt') groups.push([actor('punter'), actor('primary', 'punter')]);
  if (['kickoff', 'fieldGoal'].includes(event.type) || (event.type === 'try' && event.subtype === 'kick')) {
    groups.push([actor('kicker'), actor('primary', 'kicker')]);
  }
  if (event.type === 'pass' || (event.type === 'try' && event.subtype === 'pass')) {
    groups.push([actor('secondary', 'intendedReceiver'), actor('receiver'), actor('target', 'intendedReceiver'), resultId('pass', 'targetPlayerId')]);
  }
  groups.push([actor('returner'), resultId('return', 'returnerPlayerId')]);
  groups.push([actor('fumbler'), resultId('fumble', 'fumblerPlayerId')]);
  groups.push([actor('forcedBy', 'forcedFumble'), resultId('fumble', 'forcedByPlayerId')]);
  groups.push([actor('recoveredBy', 'fumbleRecovery'), resultId('fumble', 'recoveredByPlayerId')]);
  const onside = event.result?.kick?.onside;
  if (onside) {
    for (const [field, role] of [['recoveredByPlayerId', 'recoverer'], ['touchedByPlayerId', 'fumbler']]) {
      const id = onside[field];
      const references = [{ path: ['result', 'kick', 'onside', field] }];
      (event.participants?.others || []).forEach((person, index) => {
        if (person.playerId === id && person.role === role) references.push({ path: ['participants', 'others', index], actor: true, role });
      });
      const group = field === 'recoveredByPlayerId'
        ? groups.find(group => ['returner', 'recoveredBy'].includes(group[0].path[1]) && group.some(reference => id && idAt(event, reference) === id)) : null;
      if (group) group.push(...references); else groups.push(references);
    }
  }
  const mergeRoles = (left, right) => {
    const a = groups.find(group => group[0].path[1] === left);
    const b = groups.find(group => group[0].path[1] === right);
    const sharedId = a && b && a.some(leftReference => idAt(event, leftReference)
      && b.some(rightReference => idAt(event, leftReference) === idAt(event, rightReference)));
    if (sharedId) {
      a.push(...b); groups.splice(groups.indexOf(b), 1);
    }
  };
  if (!event.result?.laterals?.length) {
    mergeRoles('returner', 'recoveredBy');
    const fumbler = groups.find(group => group[0].path[1] === 'fumbler');
    if (event.type === 'rush' && event.participants?.primary?.playerId
      && fumbler.some(reference => idAt(event, reference) === event.participants.primary.playerId)) {
      fumbler.push(actor('primary', 'rusher'));
    }
  }
  if (event.result?.turnover?.type === 'interception' || ['interception', 'intercepted'].includes(event.subtype)) {
    const interceptor = [actor('interceptor'), resultId('turnover', 'playerId')];
    // The return can belong to a different player after a lateral.
    if (!event.result?.laterals?.length && event.participants?.interceptor?.playerId
      && event.participants.interceptor.playerId === event.participants?.returner?.playerId) {
      groups[groups.findIndex(group => group[0].path[1] === 'returner')].push(...interceptor);
    } else groups.push(interceptor);
  }
  (event.participants?.defenders || []).forEach((defender, index) => {
    const reference = { path: ['participants', 'defenders', index], actor: true, role: defender.role };
    if (defender.role === 'blocker') groups.push([reference, resultId('kick', 'blockedByPlayerId')]);
    if (['passBreakup', 'breakup'].includes(defender.role)) groups.push([reference, resultId('pass', 'brokenUpByPlayerId')]);
    if (defender.role === 'forcedFumble') groups.find(group => group[0].path[1] === 'forcedBy').push(reference);
    if (['recoverer', 'fumbleRecovery'].includes(defender.role)) groups.find(group => group.some(item => item.actor && item.path[1] === 'recoveredBy')).push(reference);
  });
  return groups;
};

const rosterPlayers = envelope => ['H', 'V'].flatMap(team => Object.entries(envelope?.rosters?.teams?.[team]?.players || {})
  .map(([playerId, player]) => ({ ...player, playerId, team })));

const applyGroup = (event, group, selected, envelope) => {
  const playerId = idAt(event, selected);
  const player = rosterPlayers(envelope).find(candidate => candidate.playerId === playerId);
  const selectedActor = selected.actor ? get(event, selected.path) : null;
  for (const reference of group) {
    if (reference.actor && typeof reference.path.at(-1) === 'number'
      && get(event, reference.path)?.role !== reference.role) continue;
    // Do not invent optional result objects or unused participant roles.
    const recoveryActor = reference.actor && reference.path[1] === 'recoveredBy';
    if (get(event, reference.path) === undefined && reference !== selected && !recoveryActor) continue;
    if (!reference.actor) set(event, reference.path, playerId);
    else {
      const previous = get(event, reference.path);
      set(event, reference.path, playerId && playerId !== 'TM' ? {
        playerId, team: player?.team || selectedActor?.team || previous?.team,
        ...(player ? { jersey: player.jersey, displayName: player.displayName, position: player.position } : selectedActor),
        role: previous?.role || reference.role,
      } : null);
    }
  }
};

export const synchronizeFootballEditedActors = (envelope, original, edited) => {
  const next = copy(edited);
  for (const group of referenceGroups(original)) {
    const changed = group.filter(reference => idAt(original, reference) !== idAt(edited, reference));
    if (!changed.length) continue;
    if (new Set(changed.map(reference => idAt(edited, reference))).size > 1) {
      throw new Error('Conflicting players were selected for the same role. Select the player again.');
    }
    applyGroup(next, group, changed[0], envelope);
  }
  if (next.participants?.defenders) next.participants.defenders = next.participants.defenders.filter(Boolean);
  const hurryActors = event => (event.participants?.defenders || []).filter(isFootballHurryDefender);
  const ids = actors => [...new Set(actors.map(actor => actor.playerId).filter(Boolean))];
  const originalIds = original.result?.pass?.hurriedByPlayerIds || [];
  const editedIds = edited.result?.pass?.hurriedByPlayerIds || [];
  const editedActors = hurryActors(edited);
  const resultChanged = JSON.stringify(originalIds) !== JSON.stringify(editedIds);
  const actorsChanged = JSON.stringify(ids(hurryActors(original))) !== JSON.stringify(ids(editedActors));
  if (resultChanged || actorsChanged) {
    if (resultChanged && actorsChanged && JSON.stringify([...editedIds].sort()) !== JSON.stringify(ids(editedActors).sort())) {
      throw new Error('Conflicting players were selected for quarterback hurries. Select the players again.');
    }
    const selectedIds = resultChanged ? [...new Set(editedIds)] : ids(editedActors);
    const players = rosterPlayers(envelope);
    next.result.pass = { ...next.result.pass, hurriedByPlayerIds: selectedIds };
    next.participants.defenders = [
      ...(next.participants.defenders || []).filter(actor => !isFootballHurryDefender(actor)),
      ...selectedIds.map(playerId => ({
        ...players.find(player => player.playerId === playerId),
        ...editedActors.find(actor => actor.playerId === playerId),
        playerId, role: 'hurry',
      })),
    ];
  }
  return next;
};

export const repairFootballEditedActorReferences = (envelope, event) => {
  if (!event || typeof event !== 'object') return event;
  let next = event;
  for (const group of referenceGroups(event)) {
    const present = group.filter(reference => idAt(event, reference));
    if (new Set(present.map(reference => idAt(event, reference))).size < 2) continue;
    // Canonical events store ID/team/role only. The old editor adds roster
    // details to the selected actor, which identifies its explicit correction.
    const editedActors = present.filter(reference => reference.actor && get(event, reference.path)?.displayName && get(event, reference.path)?.jersey != null);
    if (new Set(editedActors.map(reference => idAt(event, reference))).size !== 1) continue;
    const selected = editedActors[0];
    if (present.some(reference => reference.actor && idAt(event, reference) !== idAt(event, selected)
      && get(event, reference.path)?.displayName)) continue;
    if (next === event) next = copy(event);
    applyGroup(next, group, selected, envelope);
  }
  return next;
};
