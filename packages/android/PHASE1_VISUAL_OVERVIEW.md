# Phase 1: Multi-Server Management - Visual Overview

A visual guide to the UI components built in Phase 1.

---

## 🎨 Screen Layouts

### 1. Server List Screen (Empty State)

```
┌─────────────────────────────────────────┐
│  ← Servers                              │
│  0 servers                              │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│              🌐                         │
│                                         │
│        No Servers Added                 │
│                                         │
│   Add your first TOR hidden service    │
│        to get started                   │
│                                         │
│    ┌─────────────────────────┐         │
│    │      Add Server          │         │
│    └─────────────────────────┘         │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐ │
│  │     +     Add Server              │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 2. Server List Screen (With Servers)

```
┌─────────────────────────────────────────┐
│  Servers                                │
│  3 servers • My Server active           │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │ ┌──┐  My Server            🟣   │ ← Active badge
│  │ │ M│  abc123...onion      [×]   │
│  │ └──┘  ● Connected               │
│  │       Admin User (Admin)        │
│  │       Last: 5m ago              │
│  └─────────────────────────────────┘   │ ← Purple border
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ┌──┐  Test Server           [×] │
│  │ │ T│  test567...onion            │
│  │ └──┐  ● Disconnected             │
│  │       Last: 2h ago              │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ┌──┐  Dev Server            [×] │
│  │ │ D│  dev890...onion             │
│  │ └──┘  🟠 Bootstrapping 75%       │
│  │       Connection error msg      │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐ │
│  │     +     Add Server              │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 3. Add Server Screen

```
┌─────────────────────────────────────────┐
│  Add Server                             │
│  Add a TOR hidden service (.onion)      │
│  to connect to                          │
├─────────────────────────────────────────┤
│                                         │
│  Server Name (Optional)                 │
│  ┌─────────────────────────────────┐   │
│  │ My TOR Server                   │   │
│  └─────────────────────────────────┘   │
│  A friendly name to identify this       │
│  server                                 │
│                                         │
│  .onion Address *                       │
│  ┌─────────────────────────────────┐   │
│  │ example.onion                   │   │
│  └─────────────────────────────────┘   │
│  The .onion address of the hidden       │
│  service                                │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ℹ️ About .onion Addresses       │   │
│  │                                 │   │
│  │ TOR hidden service addresses    │   │
│  │ are 16 characters (v2) or 56    │   │
│  │ characters (v3) followed by     │   │
│  │ .onion                          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌────────────────┐ ┌──────────────┐   │
│  │ Test Connection│ │  Add Server  │   │
│  └────────────────┘ └──────────────┘   │
│                                         │
│           Cancel                        │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🎨 Component Details

### ServerCard Component

**Active Server (Connected)**
```
┌─────────────────────────────────────────┐
│ ┌──┐  Production Server        🟣  [×]  │ ← Purple border
│ │ P│  prod1234567890abc.onion           │
│ └──┘  ● Connected          alice (Admin)│
│       Last: Just now                    │
└─────────────────────────────────────────┘
```

**Inactive Server (Disconnected)**
```
┌─────────────────────────────────────────┐
│ ┌──┐  Backup Server              [×]    │
│ │ B│  backup1234567890xyz.onion         │
│ └──┘  ● Disconnected                    │
│       Last: 3d ago                      │
└─────────────────────────────────────────┘
```

**Server (Bootstrapping)**
```
┌─────────────────────────────────────────┐
│ ┌──┐  New Server                 [×]    │
│ │ N│  new1234567890test.onion           │
│ └──┘  🟠 Bootstrapping 45%              │
│       bob                               │
└─────────────────────────────────────────┘
```

**Server (Error)**
```
┌─────────────────────────────────────────┐
│ ┌──┐  Failed Server              [×]    │
│ │ F│  fail1234567890err.onion           │
│ └──┘  🔴 Connection Error               │
│       Could not establish circuit       │
└─────────────────────────────────────────┘
```

---

## 🎨 Color Scheme

### Background Colors
- **Primary Background**: `#1a1a2e` (Dark Navy)
- **Card Background**: `#2d2d44` (Lighter Navy)
- **Input Background**: `#2d2d44` (Same as cards)

### Accent Colors
- **Primary Purple**: `#7c3aed` (Buttons, borders, highlights)
- **Success Green**: `#10b981` (Connected status)
- **Warning Orange**: `#f59e0b` (Connecting/bootstrapping)
- **Error Red**: `#ef4444` (Errors, delete button)
- **Gray**: `#6b7280` (Disconnected)

### Text Colors
- **Primary Text**: `#fff` (White)
- **Secondary Text**: `#999` (Light gray)
- **Tertiary Text**: `#666` (Dark gray)
- **Placeholder**: `#666` (Dark gray)

### Status Indicator Colors
```
● #10b981  Connected
● #f59e0b  Connecting / Bootstrapping
● #ef4444  Error
● #6b7280  Disconnected
```

---

## 📐 Layout Specifications

### ServerCard Dimensions
- **Height**: Auto (min ~100px)
- **Padding**: 15px all sides
- **Border Radius**: 12px
- **Border Width**: 2px (active only)
- **Margin Bottom**: 10px

### Icon Dimensions
- **Size**: 50x50px
- **Border Radius**: 25px (circle)
- **Font Size**: 24px (letter)

### Active Badge
- **Size**: 14x14px
- **Border Radius**: 7px (circle)
- **Position**: Top-right of icon
- **Border**: 2px solid card background

### Delete Button
- **Size**: 32x32px
- **Border Radius**: 16px (circle)
- **Background**: `#ef4444`
- **Icon Size**: 24px

### Status Dot
- **Size**: 8x8px
- **Border Radius**: 4px (circle)
- **Margin Right**: 6px

---

## 🔤 Typography

### Screen Titles
- **Font Size**: 32px
- **Font Weight**: Bold
- **Color**: `#fff`
- **Margin Bottom**: 10px

### Subtitles
- **Font Size**: 14-18px
- **Color**: `#999`
- **Margin Bottom**: 20-30px

### Card Server Name
- **Font Size**: 18px
- **Font Weight**: Bold
- **Color**: `#fff`

### Card .onion Address
- **Font Size**: 12px
- **Color**: `#999`
- **Number of Lines**: 1 (ellipsize middle)

### Status Text
- **Font Size**: 12px
- **Font Weight**: 600
- **Color**: Dynamic (status color)

### User Text
- **Font Size**: 11px
- **Font Weight**: 600
- **Color**: `#7c3aed`

### Last Connected
- **Font Size**: 11px
- **Color**: `#666`

### Error Messages
- **Font Size**: 11px
- **Color**: `#ef4444`

### Buttons
- **Font Size**: 16-18px
- **Font Weight**: Bold
- **Color**: `#fff` or `#7c3aed`

---

## 🎭 Interactive States

### ServerCard States

**Normal**
```
Background: #2d2d44
Border: transparent
Opacity: 1.0
```

**Active**
```
Background: #2d2d44
Border: 2px solid #7c3aed
Opacity: 1.0
```

**Pressed** (TouchableOpacity)
```
Opacity: 0.7
```

### Button States

**Primary Button (Normal)**
```
Background: #7c3aed
Text: #fff
Opacity: 1.0
```

**Primary Button (Disabled)**
```
Background: #7c3aed
Text: #fff
Opacity: 0.5
```

**Secondary Button (Normal)**
```
Background: transparent
Border: 2px solid #7c3aed
Text: #7c3aed
Opacity: 1.0
```

**Secondary Button (Disabled)**
```
Background: transparent
Border: 2px solid #7c3aed
Text: #7c3aed
Opacity: 0.5
```

**Delete Button (Normal)**
```
Background: #ef4444
Text: #fff
```

---

## 📱 Responsive Behavior

### ServerListScreen
- **Pull to refresh**: Animated refresh control (purple)
- **Scroll**: Smooth scrolling with FlatList
- **Bottom button**: Fixed at bottom (80px clearance for list)
- **Empty state**: Centered vertically

### AddServerScreen
- **Keyboard**: KeyboardAvoidingView (iOS padding, Android height)
- **Scroll**: ScrollView when keyboard appears
- **Inputs**: Auto-focus and keyboard types

### ServerCard
- **Delete confirmation**: Native Alert dialog
- **Hit slop**: 10px on all sides for delete button
- **Ellipsize**: Middle ellipsize for long addresses

---

## 🎬 Animations

### Implicit Animations
- TouchableOpacity on all touchable elements
- ActivityIndicator during loading
- RefreshControl on pull-to-refresh

### Future Animations (Phase 2+)
- Server status transitions (fade)
- Card appearance (slide in)
- Delete animation (slide out)
- Bootstrap progress (animated bar)

---

## 🔍 Accessibility

### Implemented
- Touch targets: Minimum 32x32px (delete button)
- Hit slop: Extended touch area for small buttons
- Color contrast: All text meets WCAG standards
- Labels: Descriptive text for all inputs

### Future Improvements
- Screen reader support
- Accessibility labels
- High contrast mode
- Font scaling support

---

## 📊 Visual Hierarchy

```
Primary (Most Important)
  ↓
Screen Title (32px bold)
Active Server Card (purple border)
  ↓
Secondary
  ↓
Add Server Button (primary purple)
Server Cards (regular)
  ↓
Tertiary
  ↓
Server addresses, status text
Last connected times
  ↓
Actions
  ↓
Delete buttons, secondary buttons
```

---

## 🎨 Design Consistency

All screens maintain consistency with existing:
- **LoginScreen.tsx**: Same colors, button styles, inputs
- **RegisterScreen.tsx**: Same form layout, spacing
- **LoadingScreen.tsx**: Same background, text styles

Design system follows Material Design principles:
- Card elevation through shadows/borders
- Consistent spacing (8px grid)
- Touch feedback on all interactions
- Clear visual states

---

**Visual Design Complete!** ✨

All components are production-ready with:
- Clean, modern dark theme
- Consistent spacing and typography
- Clear visual hierarchy
- Smooth interactions
- Error states and empty states
