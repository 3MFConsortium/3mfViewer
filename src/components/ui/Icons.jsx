import React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Boxes,
  Camera,
  ChevronRight,
  Circle,
  Box,
  Expand,
  Eye,
  EyeOff,
  FileUp,
  Grid3x3,
  HelpCircle,
  Home,
  Info,
  Layers,
  Lightbulb,
  Menu,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  Shapes,
  Square,
  Sun,
  Upload,
  AudioWaveform,
  Minus,
  X,
} from "lucide-react";

// ---- Tree icons & basics ----
export const IconCube = () => <Box className="w-5 h-5" />;
export const IconLight = () => <Lightbulb className="w-5 h-5" />;
export const IconGroup = () => <Boxes className="w-5 h-5" />;
export const IconGeometry = () => <Shapes className="w-5 h-5" />;
export const IconMaterial = () => <Circle className="w-5 h-5" />;
export const IconScalar = () => <AudioWaveform className="w-5 h-5" />;
export const IconPrefs = () => <Settings className="w-5 h-5" />;
export const IconMenu = () => <Menu className="w-5 h-5" />;
export const IconClose = () => <X className="w-4 h-4" />;
export const IconDock = () => <MoreHorizontal className="w-5 h-5" />;
export const IconHelp = () => <Info className="w-5 h-5" />;
export const IconHome = () => <Home className="w-5 h-5" />;
export const IconQuestion = () => <HelpCircle className="w-5 h-5" />;
export const IconUpload = () => <Upload className="w-5 h-5" />;
export const IconExport = () => <FileUp className="w-5 h-5" />;
export const IconValidate = () => <ShieldCheck className="w-5 h-5" />;
export const IconVisible = () => <Eye className="w-4 h-4" />;
export const IconHidden = () => <EyeOff className="w-4 h-4" />;

export const IconCaret = ({ open }) => (
  <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
);

// ---- Bottom navbar controls ----
export const IconPlus = () => <Plus className="w-5 h-5" />;
export const IconMinus = () => <Minus className="w-5 h-5" />;
export const IconFit = () => <Expand className="w-5 h-5" />;
export const IconCamera = () => <Camera className="w-5 h-5" />;
export const IconReset = () => <RotateCcw className="w-5 h-5" />;
export const IconGrid = () => <Grid3x3 className="w-5 h-5" />;
export const IconGround = () => <Layers className="w-5 h-5" />;
export const IconStats = () => <BarChart3 className="w-5 h-5" />;
export const IconShadows = () => <Sun className="w-5 h-5" />;

export const IconWireframe = () => <Square className="w-5 h-5" />;
export const IconWireframeOverlay = () => (
  <Shapes className="w-5 h-5" />
);

// Pan arrows
export const IconArrowLeft  = () => <ArrowLeft className="w-5 h-5" />;
export const IconArrowRight = () => <ArrowRight className="w-5 h-5" />;
export const IconArrowUp    = () => <ArrowUp className="w-5 h-5" />;
export const IconArrowDown  = () => <ArrowDown className="w-5 h-5" />;
