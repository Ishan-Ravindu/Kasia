export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

export interface CameraStatus {
  hasCamera: boolean;
  permissionState: CameraPermissionState;
}

export type CameraRequestResult =
  | { ok: true }
  | { ok: false; reason: "blocked" | "dismissed" | "no-device" | "unknown" };

class CameraPermissionService {
  private static instance: CameraPermissionService;
  private hardDenied = false;

  static getInstance(): CameraPermissionService {
    if (!CameraPermissionService.instance) {
      CameraPermissionService.instance = new CameraPermissionService();
    }
    return CameraPermissionService.instance;
  }

  async checkCameraStatus(): Promise<CameraStatus> {
    return this._checkCameraStatusInternal();
  }

  async requestCameraPermission(opts?: {
    userGesture?: boolean;
  }): Promise<CameraRequestResult> {
    if (!navigator.mediaDevices) return { ok: false, reason: "unknown" };
    const state = await this._getPermissionState();
    if (state === "denied" || this.hardDenied)
      return { ok: false, reason: "blocked" };
    if (!opts?.userGesture) return { ok: false, reason: "unknown" };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((t) => t.stop());
      return { ok: true };
    } catch (e) {
      const name = (e as DOMException)?.name || "";
      if (name === "NotAllowedError") {
        const s = await this._getPermissionState().catch(() => undefined);
        if (s === "denied") {
          this.hardDenied = true;
          return { ok: false, reason: "blocked" };
        }
        return { ok: false, reason: "dismissed" };
      }
      if (name === "NotFoundError" || name === "OverconstrainedError")
        return { ok: false, reason: "no-device" };
      if (name === "SecurityError") return { ok: false, reason: "unknown" };
      return { ok: false, reason: "dismissed" };
    }
  }

  private async _checkCameraStatusInternal(): Promise<CameraStatus> {
    if (!navigator.mediaDevices) {
      return { hasCamera: false, permissionState: "unknown" };
    }

    const mediaDevices = navigator.mediaDevices;

    try {
      // Check permission status using Permissions API (modern browsers)
      if ("permissions" in navigator) {
        const permissionStatus = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });

        if (permissionStatus.state === "granted") {
          // Permissions granted, we can enumerate devices
          const devices = await mediaDevices.enumerateDevices();
          const hasCamera = devices.some((d) => d.kind === "videoinput");
          return { hasCamera, permissionState: "granted" };
        } else if (permissionStatus.state === "denied") {
          // When permissions are denied, we can't enumerate devices,
          // but there might still be camera hardware. Assume there is.
          return { hasCamera: true, permissionState: "denied" };
        } else {
          // Permission not asked yet ('prompt' state)
          const hasCamera = await this._hasVideoInputSafe(mediaDevices);
          return { hasCamera, permissionState: "prompt" };
        }
      } else {
        // Fallback for older browsers - try enumerateDevices
        try {
          const devices = await mediaDevices.enumerateDevices();
          const hasCamera = devices.some((d) => d.kind === "videoinput");
          return {
            hasCamera,
            permissionState: hasCamera ? "prompt" : "unknown",
          };
        } catch {
          // enumerateDevices failed (likely no permissions)
          return { hasCamera: true, permissionState: "prompt" };
        }
      }
    } catch (error) {
      console.warn("Camera permission check failed:", error);
      return { hasCamera: true, permissionState: "unknown" };
    }
  }

  private async _getPermissionState(): Promise<CameraPermissionState> {
    if ("permissions" in navigator) {
      try {
        const ps = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        return ps.state as CameraPermissionState;
      } catch {
        /* noop */
      }
    }
    try {
      const devices = await navigator.mediaDevices!.enumerateDevices();
      const hasCam = devices.some((d) => d.kind === "videoinput");
      return hasCam ? "prompt" : "unknown";
    } catch {
      return "unknown";
    }
  }

  onPermissionChange(cb: (state: CameraPermissionState) => void) {
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((ps) => {
          ps.onchange = () => {
            const s = ps.state as CameraPermissionState;
            if (s !== "denied") this.hardDenied = false;
            cb(s);
          };
        })
        .catch(() => {});
    }
  }

  private async _hasVideoInputSafe(md: MediaDevices): Promise<boolean> {
    try {
      const ds = await md.enumerateDevices();
      return ds.some((d) => d.kind === "videoinput");
    } catch {
      return true;
    }
  }
}

export const cameraPermissionService = CameraPermissionService.getInstance();
