def edit(path, pairs):
    s = open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        assert old in s, (path, old[:80])
        s = s.replace(old, new, 1)
    open(path, 'w', encoding='utf-8', newline='').write(s)

edit('src/lib/design/surgery.ts', [
("function planPush(target: Cell, cells: Cell[], deltaArea: number): PushPlan | null {", "function planPushes(target: Cell, cells: Cell[], deltaArea: number): PushPlan[] {"),
("""  if (!candidates.length) return null;
  const goal = Math.abs(deltaArea);
  const full = candidates.filter((c) => c.achieved >= goal * 0.9);
  const pool = full.length ? full : candidates;
  return pool.sort((a, b) => (full.length ? a.cost - b.cost : b.achieved - a.achieved))[0];
}""", """  const goal = Math.abs(deltaArea);
  const full = candidates.filter((c) => c.achieved >= goal * 0.9).sort((a, b) => a.cost - b.cost);
  const partial = candidates.filter((c) => c.achieved < goal * 0.9 && c.achieved >= goal * 0.5).sort((a, b) => b.achieved - a.achieved);
  return [...full, ...partial];
}"""),
("""      const push = planPush(cell, cells, delta);
      if (push && push.achieved >= Math.abs(delta) * 0.5) {
        cells = applyPush(cell, push, cells, delta > 0);
        const grown = cells.find((c) => c.id === cell.id)!;
        achievedInfo = { wanted: Math.round(wanted), got: Math.round(area(grown.rect)), roomName: cell.name };
        const names = push.neighbours.map((n) => n.name).join(', ');
        notes.push(`${cell.name} ${delta > 0 ? 'grew' : 'shrank'} by moving its ${push.dir} wall ${push.t} ft; ${names} ${delta > 0 ? 'gave up' : 'took'} the strip. Every other room stayed where it was.`);
        continue;
      }""", """      // Try the cheapest clean wall first; keep the first one that leaves a plan every rule still accepts.
      let pushed = false;
      for (const push of planPushes(cell, cells, delta)) {
        const trial = applyPush(cell, push, cells, delta > 0);
        const probe = rebuild(request, trial, []);
        if (!probe || !validateFloorPlan(probe).isValid) continue;
        cells = trial;
        const grown = cells.find((c) => c.id === cell.id)!;
        achievedInfo = { wanted: Math.round(wanted), got: Math.round(area(grown.rect)), roomName: cell.name, before: Math.round(area(cell.rect)) };
        const names = push.neighbours.map((n) => n.name).join(', ');
        notes.push(`${cell.name} ${delta > 0 ? 'grew' : 'shrank'} by moving its ${push.dir} wall ${push.t} ft; ${names} ${delta > 0 ? 'gave up' : 'took'} the strip. Every other room stayed where it was.`);
        pushed = true;
        break;
      }
      if (pushed) continue;"""),
("achievedInfo = { wanted: Math.round(wanted), got: Math.round(area(got.rect)), roomName: cell.name };\n      notes.push(`${cell.name} and its neighbours", "achievedInfo = { wanted: Math.round(wanted), got: Math.round(area(got.rect)), roomName: cell.name, before: Math.round(area(cell.rect)) };\n      notes.push(`${cell.name} and its neighbours"),
("achieved?: { wanted: number; got: number; roomName: string } }", "achieved?: { wanted: number; got: number; roomName: string; before: number } }"),
("let achievedInfo: { wanted: number; got: number; roomName: string } | undefined;", "let achievedInfo: { wanted: number; got: number; roomName: string; before: number } | undefined;"),
("""      const floor = added.floor;
      const onFloor = cells.filter((c) => c.floor === floor && c.type !== 'void');
      const anchor = added.attachedTo ? cells.find((c) => c.id === added.attachedTo) : undefined;
      const newRoom = toPRoom(added, 1);
""", """      const wantedFloor = added.floor;
      const terraceArea = (f: number) => sum(cells.filter((c) => c.floor === f && c.type === 'terrace').map((c) => area(c.rect)));
      const floorOrder = op.floor !== undefined || added.attachedTo
        ? [wantedFloor]
        : [wantedFloor, ...Array.from({ length: design.floorsCount }, (_, f) => f).filter((f) => f !== wantedFloor).sort((a, b) => terraceArea(b) - terraceArea(a))];
      const anchor = added.attachedTo ? cells.find((c) => c.id === added.attachedTo) : undefined;
      let chosen: Cell[] | null = null;
      let placedOn = -1;
      let onFloor: Cell[] = [];
      for (const floor of floorOrder) {
      onFloor = cells.filter((c) => c.floor === floor && c.type !== 'void');
      const newRoom = toPRoom({ ...added, floor }, 1);
"""),
("""      let chosen: Cell[] | null = null;
      const seeds = anchor""", """      const seeds = anchor"""),
("""        if (attempt) { chosen = group; cells = attempt; break; }
      }
      if (!chosen) return { ok: false, reason: `There is no place on the ${floor === 0 ? 'ground' : 'upper'} floor to fit a ${added.name} at a usable size without moving the stair or courtyard.` };
      strategy = 'local-resolve';
      notes.push(""", """        if (attempt) { chosen = group; cells = attempt; break; }
      }
      if (chosen) { placedOn = floor; break; }
      }
      if (!chosen) return { ok: false, reason: `There is no place on ${floorOrder.length > 1 ? 'any floor' : `the ${wantedFloor === 0 ? 'ground' : 'upper'} floor`} to fit a ${added.name} at a usable size without moving the stair or courtyard.` };
      strategy = 'local-resolve';
      if (placedOn !== wantedFloor) {
        added.floor = placedOn;
        cells = cells.map((c) => (c.id === added.id ? { ...c, floor: placedOn } : c));
        notes.push(`There was no room for the ${added.name} on the ${wantedFloor === 0 ? 'ground' : 'upper'} floor without squeezing other rooms, so it was placed on the ${placedOn === 0 ? 'ground' : 'upper'} floor, where there is spare space.`);
      }
      notes.push("""),
])

edit('src/lib/design/whatIf.ts', [
("""        ? `${achieved.roomName}: ${Math.round(program.rooms.find((r) => r.name === achieved.roomName)?.areaSqFt ?? 0) || 'was'} → ${achieved.got} sq ft${""", """        ? `${achieved.roomName}: ${achieved.before} → ${achieved.got} sq ft${"""),
("""    const attachTo = type === 'bathroom' && /attached|ensuite|en-suite/.test(text)
      ? program.rooms.find((room) => isBedroomType(room.type) && (floor === undefined || room.floor === floor) && !program.rooms.some((bath) => bath.type === 'bathroom' && bath.attachedTo === room.id))
      : undefined;""", """    const wantsMaster = /master/.test(text);
    const attachTo = type === 'bathroom' && /attached|ensuite|en-suite/.test(text)
      ? program.rooms.find((room) => (wantsMaster ? room.type === 'master_bedroom' : isBedroomType(room.type)) && (floor === undefined || room.floor === floor) && !program.rooms.some((bath) => bath.type === 'bathroom' && bath.attachedTo === room.id))
        || (wantsMaster ? program.rooms.find((room) => room.type === 'master_bedroom') : undefined)
      : undefined;"""),
])
