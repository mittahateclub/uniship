'use client';

// Icon system — smooth Phosphor duotone icons behind the lucide-react names
// the codebase already uses. Call sites keep lucide-style props (size,
// className, strokeWidth); strokeWidth is accepted and ignored.
import {
  WarningCircle, Warning, TextAlignLeft, ArrowLeft as PArrowLeft, ArrowRight as PArrowRight,
  ArrowUpRight as PArrowUpRight, Medal, SealCheck, ChartBar, Bell as PBell, BookOpen as PBookOpen,
  BookmarkSimple, Brain as PBrain, Briefcase as PBriefcase, Buildings, Calendar as PCalendar,
  CalendarDots, CalendarBlank, CalendarPlus as PCalendarPlus, Camera as PCamera, Check as PCheck,
  CheckCircle as PCheckCircle, CaretDown, CaretLeft, CaretRight, CaretUp, ClipboardText,
  Clock as PClock, CloudArrowUp, Code as PCode, CodeSimple, Copy as PCopy, Database as PDatabase,
  DownloadSimple, ArrowSquareOut, Eye as PEye, EyeSlash, FileText as PFileText, FunnelSimple,
  Flag as PFlag, Flask, Kanban, Globe as PGlobe, GraduationCap as PGraduationCap, Hash as PHash,
  Question, Keyboard as PKeyboard, SquaresFour, CircleNotch, Lock as PLock, SignIn, SignOut,
  EnvelopeSimple, MapPin as PMapPin, ArrowsOut, ChatCircle, Microphone, MinusCircle as PMinusCircle,
  Monitor as PMonitor, MonitorPlay as PMonitorPlay, Moon as PMoon, SidebarSimple,
  PencilSimple, Phone as PPhone, PushPin, Play as PPlay, Plus as PPlus, PlusCircle as PPlusCircle,
  PresentationChart, ArrowsClockwise, ArrowCounterClockwise, FloppyDisk, MagnifyingGlass,
  PaperPlaneTilt, GearSix, Shield as PShield, ShieldCheck as PShieldCheck, Sparkle, Star as PStar,
  Sun as PSun, Tag as PTag, Target as PTarget, Terminal as PTerminal, Trash, TrendUp,
  Trophy as PTrophy, TextT, UploadSimple, User as PUser, UserPlus as PUserPlus, UsersThree,
  WifiHigh, X as PX, XCircle as PXCircle, Wallet as PWallet,
} from '@phosphor-icons/react';
import type { Icon, IconProps, IconWeight } from '@phosphor-icons/react';

type LucideLikeProps = Omit<IconProps, 'weight'> & {
  strokeWidth?: number | string;
  weight?: IconWeight;
};

// Default weight is "fill" — solid, soft silhouettes with no interior hairlines,
// the smoothest non-sharp look. Directional/symbol glyphs (arrows, carets, check,
// x, plus) override to "bold" since a filled arrow/x reads oddly.
function smooth(Glyph: Icon, weight: IconWeight = 'fill') {
  function SmoothIcon({ strokeWidth: _ignored, ...props }: LucideLikeProps) {
    return <Glyph weight={weight} {...props} />;
  }
  return SmoothIcon;
}

export const AlertCircle = smooth(WarningCircle);
export const Wallet = smooth(PWallet);
export const AlertTriangle = smooth(Warning);
export const AlignLeft = smooth(TextAlignLeft, 'bold');
export const ArrowLeft = smooth(PArrowLeft, 'bold');
export const ArrowRight = smooth(PArrowRight, 'bold');
export const ArrowUpRight = smooth(PArrowUpRight, 'bold');
export const Award = smooth(Medal);
export const BadgeCheck = smooth(SealCheck);
export const BarChart3 = smooth(ChartBar);
export const Bell = smooth(PBell);
export const BookOpen = smooth(PBookOpen);
export const Bookmark = smooth(BookmarkSimple);
export const BookmarkCheck = smooth(BookmarkSimple, 'fill');
export const Brain = smooth(PBrain);
export const Briefcase = smooth(PBriefcase);
export const Building2 = smooth(Buildings);
export const Calendar = smooth(PCalendar);
export const CalendarClock = smooth(CalendarDots);
export const CalendarDays = smooth(CalendarBlank);
export const CalendarPlus = smooth(PCalendarPlus);
export const Camera = smooth(PCamera);
export const Check = smooth(PCheck, 'bold');
export const CheckCircle = smooth(PCheckCircle);
export const CheckCircle2 = smooth(PCheckCircle);
export const ChevronDown = smooth(CaretDown, 'bold');
export const ChevronLeft = smooth(CaretLeft, 'bold');
export const ChevronRight = smooth(CaretRight, 'bold');
export const ChevronUp = smooth(CaretUp, 'bold');
export const ClipboardCheck = smooth(ClipboardText);
export const Clock = smooth(PClock);
export const Clock3 = smooth(PClock);
export const CloudUpload = smooth(CloudArrowUp);
export const Code = smooth(PCode, 'bold');
export const Code2 = smooth(CodeSimple, 'bold');
export const Copy = smooth(PCopy);
export const Database = smooth(PDatabase);
export const Download = smooth(DownloadSimple);
export const ExternalLink = smooth(ArrowSquareOut, 'bold');
export const Eye = smooth(PEye);
export const EyeOff = smooth(EyeSlash);
export const FileText = smooth(PFileText);
export const Filter = smooth(FunnelSimple);
export const Flag = smooth(PFlag);
export const FlaskConical = smooth(Flask);
export const FolderKanban = smooth(Kanban);
export const Globe = smooth(PGlobe, 'bold');
export const GraduationCap = smooth(PGraduationCap);
export const Hash = smooth(PHash, 'bold');
export const HelpCircle = smooth(Question);
export const Keyboard = smooth(PKeyboard);
export const LayoutDashboard = smooth(SquaresFour);
export const Loader2 = smooth(CircleNotch, 'bold');
export const Lock = smooth(PLock);
export const LogIn = smooth(SignIn);
export const LogOut = smooth(SignOut);
export const Mail = smooth(EnvelopeSimple);
export const MapPin = smooth(PMapPin);
export const Maximize = smooth(ArrowsOut, 'bold');
export const MessageCircle = smooth(ChatCircle);
export const Mic = smooth(Microphone);
export const MinusCircle = smooth(PMinusCircle);
export const Monitor = smooth(PMonitor);
export const MonitorPlay = smooth(PMonitorPlay);
export const Moon = smooth(PMoon);
export const PanelLeftClose = smooth(SidebarSimple);
export const PanelLeftOpen = smooth(SidebarSimple);
export const Pencil = smooth(PencilSimple);
export const Phone = smooth(PPhone);
export const Pin = smooth(PushPin);
export const Play = smooth(PPlay);
export const Plus = smooth(PPlus, 'bold');
export const PlusCircle = smooth(PPlusCircle);
export const Presentation = smooth(PresentationChart);
export const RefreshCw = smooth(ArrowsClockwise, 'bold');
export const RotateCcw = smooth(ArrowCounterClockwise, 'bold');
export const Save = smooth(FloppyDisk);
export const Search = smooth(MagnifyingGlass);
export const Send = smooth(PaperPlaneTilt);
export const Settings = smooth(GearSix);
export const Shield = smooth(PShield);
export const ShieldCheck = smooth(PShieldCheck);
export const Sparkles = smooth(Sparkle);
export const Star = smooth(PStar);
export const Sun = smooth(PSun);
export const Tag = smooth(PTag);
export const Target = smooth(PTarget);
export const Terminal = smooth(PTerminal, 'bold');
export const Trash2 = smooth(Trash);
export const TrendingUp = smooth(TrendUp);
export const Trophy = smooth(PTrophy);
export const Type = smooth(TextT, 'bold');
export const Upload = smooth(UploadSimple);
export const User = smooth(PUser);
export const UserPlus = smooth(PUserPlus);
export const Users = smooth(UsersThree);
export const Wifi = smooth(WifiHigh);
export const X = smooth(PX, 'bold');
export const XCircle = smooth(PXCircle);
