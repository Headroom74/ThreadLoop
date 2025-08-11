#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeAudioLooper, "NativeAudioLooper",
  CAP_PLUGIN_METHOD(loadAudio, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(setLoopPoints, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(setRate, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(setPitch, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(play, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(pause, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(seek, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(getCurrentTime, CAPPluginReturnPromise);
)
