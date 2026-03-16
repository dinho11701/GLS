import { StyleSheet } from "react-native";
import { PALETTE } from "./theme";

export const loginStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.primary,
  },

  scrollInner: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },

  container: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    paddingHorizontal: 28,
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 28,
  },

  logo: {
    width: 90,
    height: 90,
  },

  brandLine1: {
    color: PALETTE.white,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },

  brandLine2: {
    color: PALETTE.white,
    fontSize: 26,
    fontWeight: "800",
    marginTop: 2,
  },

  roleSwitchRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },

  roleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: PALETTE.chipBg,
  },

  roleChipActive: {
    backgroundColor: PALETTE.chipActive,
  },

  roleChipText: {
    color: PALETTE.white,
    fontWeight: "700",
  },

  roleLabel: {
    color: PALETTE.textDim,
    marginTop: 10,
    fontWeight: "700",
  },

  form: {
    marginTop: 12,
    width: "100%",
  },

  label: {
    color: PALETTE.white,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },

  input: {
    backgroundColor: PALETTE.offWhite,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 16,
    color: "#0F172A",
    width: "100%",
  },

  inputWrap: {
    width: "100%",
    position: "relative",
  },

  inputWithIcon: {
    paddingRight: 48,
  },

  eyeBtn: {
    position: "absolute",
    right: 10,
    top: 10,
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  errorText: {
    color: "#FF6B6B",
    marginBottom: 10,
    fontWeight: "600",
  },

  buttonPrimary: {
    backgroundColor: PALETTE.coral,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
    marginTop: 6,
  },

  buttonPrimaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
  },

  linkOnly: {
    paddingVertical: 20,
    alignItems: "center",
  },

  linkOnlyText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  disabled: {
    opacity: 0.6,
  },
});