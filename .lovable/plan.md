YIMS Core System Upgrade — QuickAdd + Custom Types + Realtime (Tab-Aware Lean Mode)

Upgrade the application using a minimal, reusable, credit-efficient implementation aligned with the existing YIMS navigation structure. Do not redesign UI or break current workflows. Improve functionality within existing tabs only.

Scope — Apply Features Per Existing Tabs
Dashboard

No structural change

Allow realtime refresh of summary counts (items, stock, low stock)

Items

Enable Universal Quick Add inside:

Location selector

Category selector

Show location as: Name (custom_type_label || location_type)

Realtime update when items created/edited/deleted

Prevent duplicate category/location creation

Categories

Add Quick Add inside parent selector

Prevent duplicate category names (case-insensitive)

Realtime sync for category create/update/delete

Locations

Ensure custom_type_label is displayed everywhere

Use helper:

getLocationDisplay(location)


Enable Quick Add for parent location

Realtime update for location changes

Never show raw location_type directly

Stock Operations

Quick Add for:

Location

Item (optional minimal)

Realtime stock update sync

Prevent duplicate locations

Scan

Display location using custom label

Realtime reflect stock/location updates

No UI redesign

History

Realtime append new activity entries

No heavy filters or redesign

Import / Export

Use updated entity display (custom labels)

No feature expansion

Reports

Use corrected location display logic

Allow realtime refresh when data changes

Approvals

Realtime reflect approve/reject status

No workflow change

Users

No structural change

Optional realtime refresh (lightweight)

System Logs

Realtime append new logs

No heavy UI

Settings

No redesign

Keep compatibility

Core Features to Implement
1. Universal Quick Add (Reusable Component)

Used in:
Items / Categories / Locations / Stock Operations / Filters

Requirements:

Searchable dropdown

“+ Add New” option

Inline create or small modal

Auto-select after create

Prevent duplicate names (trim + case-insensitive)

Optimistic UI update

Rollback on DB failure

Reuse existing service/API layer

Minimal UI only

2. Global Custom Location Type Display

Central helpers:

getLocationTypeDisplay(location)
getLocationDisplay(location)


Rules:

Replace ALL UI usage of location.location_type

Handle null / empty safely

Ensure queries fetch custom_type_label

Never render blank

No schema change

3. Real-Time Multi-User Sync (Lightweight)

Enable Supabase realtime for:

items

locations

stock

categories

history (append-only)

Rules:

Reflect insert/update/delete from other users

Update local cache instead of full refetch when possible

Ignore own-client echo events

Prevent infinite re-render loops

Auto unsubscribe on component unmount

No custom websocket engine

No global state rewrite

4. Performance Rules

Memoize dropdown options

Avoid repeated DB calls

Deduplicate identical queries

Optimistic updates

No duplicate display logic

Keep bundle small

No heavy dependencies

5. Architecture (Do Not Break Existing Flow)

Reusable Components
→ Existing Entity Service Layer
→ Supabase
→ Local Cache / State
→ UI Sync

Maintain backward compatibility.

6. Stability & Safety

Prevent duplicate entity creation

Handle null/undefined safely

Graceful DB failure fallback

No UI crash on missing fields

Safe realtime unsubscribe

No memory leaks

No workflow regression

Deliver Goal

Implement a stable, tab-aware core upgrade providing:

Quick Add across relevant selectors

Correct custom location label everywhere

Lightweight realtime multi-user sync

Clean reusable architecture

No regressions

Credit-efficient build