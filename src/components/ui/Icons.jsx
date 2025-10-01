import React from "react";
import {
  // Tree / general UI
  FaCube,
  FaLightbulb,
  FaObjectGroup,
  FaChevronRight,
  FaWaveSquare,
  FaShapes,
  FaCircle,
  FaSlidersH,
  FaBars,
  FaTimes,
  FaEllipsisH,
  FaInfoCircle,
  FaQuestionCircle,
  FaHome,
  FaCog,
  FaUpload,
  FaFileExport,
  FaShieldAlt,
  FaEye,
  FaEyeSlash,
  // Bottom navbar actions
  FaPlus,
  FaMinus,
  FaExpand,
  FaCamera,
  FaUndoAlt,
  FaBorderAll,
  FaLayerGroup,
  FaChartBar,
  FaDrawPolygon,
  FaRegEye,
  // Pan arrows
  FaArrowLeft,
  FaArrowRight,
  FaArrowUp,
  FaArrowDown,
} from "react-icons/fa";
import { TbShadow } from "react-icons/tb"; // rendering options

// ---- Tree icons & basics ----
export const IconCube = () => <FaCube className="w-5 h-5" />;
export const IconLight = () => <FaLightbulb className="w-5 h-5" />;
export const IconGroup = () => <FaObjectGroup className="w-5 h-5" />;
export const IconGeometry = () => <FaShapes className="w-5 h-5" />;
export const IconMaterial = () => <FaCircle className="w-5 h-5" />;
export const IconScalar = () => <FaWaveSquare className="w-5 h-5" />;
export const IconPrefs = () => <FaCog className="w-5 h-5" />;
export const IconMenu = () => <FaBars className="w-5 h-5" />;
export const IconClose = () => <FaTimes className="w-4 h-4" />;
export const IconDock = () => <FaEllipsisH className="w-5 h-5" />;
export const IconHelp = () => <FaInfoCircle className="w-5 h-5" />;
export const IconHome = () => <FaHome className="w-5 h-5" />;
export const IconQuestion = () => <FaQuestionCircle className="w-5 h-5" />;
export const IconUpload = () => <FaUpload className="w-5 h-5" />;
export const IconExport = () => <FaFileExport className="w-5 h-5" />;
export const IconValidate = () => <FaShieldAlt className="w-5 h-5" />;
export const IconVisible = () => <FaEye className="w-4 h-4" />;
export const IconHidden = () => <FaEyeSlash className="w-4 h-4" />;

export const IconCaret = ({ open }) => (
  <FaChevronRight className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
);

// ---- Bottom navbar controls ----
export const IconPlus = () => <FaPlus className="w-5 h-5" />;
export const IconMinus = () => <FaMinus className="w-5 h-5" />;
export const IconFit = () => <FaExpand className="w-5 h-5" />;
export const IconCamera = () => <FaCamera className="w-5 h-5" />;
export const IconReset = () => <FaUndoAlt className="w-5 h-5" />;
export const IconGrid = () => <FaBorderAll className="w-5 h-5" />;
export const IconGround = () => <FaLayerGroup className="w-5 h-5" />;
export const IconStats = () => <FaChartBar className="w-5 h-5" />;
export const IconShadows = () => <TbShadow className="w-5 h-5" />;

export const IconWireframe = () => <FaDrawPolygon className="w-5 h-5" />;
export const IconWireframeOverlay = () => <FaRegEye className="w-5 h-5" />;

// Pan arrows
export const IconArrowLeft  = () => <FaArrowLeft  className="w-5 h-5" />;
export const IconArrowRight = () => <FaArrowRight className="w-5 h-5" />;
export const IconArrowUp    = () => <FaArrowUp    className="w-5 h-5" />;
export const IconArrowDown  = () => <FaArrowDown  className="w-5 h-5" />;
