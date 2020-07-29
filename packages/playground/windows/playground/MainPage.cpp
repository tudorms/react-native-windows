#include "pch.h"
#include "MainPage.h"
#include "MainPage.g.cpp"
#include <App.h>

using namespace winrt;
using namespace Windows::ApplicationModel::Activation;
using namespace Windows::Foundation;
using namespace Windows::UI;
using namespace xaml;
using namespace xaml::Controls;
using namespace xaml::Media;
using namespace Windows::Storage;
using namespace Windows::Storage::Streams;
using namespace Windows::Graphics::Imaging;
using namespace Windows::Storage::Pickers;

namespace winrt::playground::implementation {

MainPage::MainPage() {
  InitializeComponent();

  x_DebuggerPort().Text(std::to_wstring(Host().InstanceSettings().DebuggerPort()));

  // IsEditable is only supported on RS4 or higher
  if (Windows::Foundation::Metadata::ApiInformation::IsApiContractPresent(
          L"Windows.Foundation.UniversalApiContract", 6)) {
    x_rootComponentNameCombo().IsEditable(true);
    x_entryPointCombo().IsEditable(true);
  }

#if !defined(USE_HERMES)
  x_engineHermes().IsEnabled(false);
#endif

#if !defined(USE_V8)
  x_engineV8().IsEnabled(false);
#endif

  x_JsEngine().SelectedIndex(0);
}

void MainPage::OnLoadClick(
    Windows::Foundation::IInspectable const & /*sender*/,
    xaml::RoutedEventArgs const & /*args*/) {
  auto host = Host();

  winrt::hstring bundleFile;

  if (x_entryPointCombo().SelectedItem().try_as<ComboBoxItem>()) {
    bundleFile = unbox_value<hstring>(x_entryPointCombo().SelectedItem().as<ComboBoxItem>().Content());
  } else {
    bundleFile = unbox_value<hstring>(x_entryPointCombo().SelectedItem());
  }
  host.InstanceSettings().JavaScriptBundleFile(bundleFile);

  auto mainComponentName = unbox_value<hstring>(x_rootComponentNameCombo().SelectedItem().as<ComboBoxItem>().Content());
  ReactRootView().ComponentName(mainComponentName);
  ReactRootView().ReactNativeHost(host);

  host.InstanceSettings().UseDeveloperSupport(true);
  host.InstanceSettings().UseWebDebugger(x_UseWebDebuggerCheckBox().IsChecked().GetBoolean());
  host.InstanceSettings().UseDirectDebugger(x_UseDirectDebuggerCheckBox().IsChecked().GetBoolean());
  host.InstanceSettings().DebuggerBreakOnNextLine(x_BreakOnFirstLineCheckBox().IsChecked().GetBoolean());
  host.InstanceSettings().UseFastRefresh(x_UseFastRefreshCheckBox().IsChecked().GetBoolean());
  host.InstanceSettings().DebuggerPort(static_cast<uint16_t>(std::stoi(std::wstring(x_DebuggerPort().Text()))));
  host.InstanceSettings().JSIEngineOverride(
      static_cast<Microsoft::ReactNative::JSIEngine>(x_JsEngine().SelectedIndex()));
  if (!m_bundlerHostname.empty()) {
    host.InstanceSettings().DebugHost(m_bundlerHostname);
  }

  // Nudge the ReactNativeHost to create the instance and wrapping context
  host.ReloadInstance();
}

void winrt::playground::implementation::MainPage::x_entryPointCombo_SelectionChanged(
    winrt::Windows::Foundation::IInspectable const & /*sender*/,
    xaml::Controls::SelectionChangedEventArgs const & /*e*/) {
  if (x_rootComponentNameCombo()) {
    if (x_entryPointCombo().SelectedItem() && x_entryPointCombo().SelectedItem().try_as<ComboBoxItem>() &&
        std::wstring(unbox_value<hstring>(x_entryPointCombo().SelectedItem().as<ComboBoxItem>().Content()))
                .compare(L"Samples\\rntester") == 0) {
      x_rootComponentNameCombo().SelectedIndex(0);
    } else {
      x_rootComponentNameCombo().SelectedIndex(1);
    }
  }
}

void MainPage::OnNavigatedTo(xaml::Navigation::NavigationEventArgs const &e) {
  m_bundlerHostname = unbox_value<hstring>(e.Parameter());
}

Microsoft::ReactNative::ReactNativeHost MainPage::Host() noexcept {
  return Application::Current().as<App>()->Host();
}

Microsoft::ReactNative::ReactInstanceSettings MainPage::InstanceSettings() noexcept {
  if (!m_instanceSettings) {
    m_instanceSettings = Microsoft::ReactNative::ReactInstanceSettings();
  }

  return m_instanceSettings;
}

Windows::Foundation::Collections::IVector<Microsoft::ReactNative::IReactPackageProvider>
MainPage::PackageProviders() noexcept {
  if (!m_packageProviders) {
    m_packageProviders = single_threaded_vector<Microsoft::ReactNative::IReactPackageProvider>();
  }

  return m_packageProviders;
}

} // namespace winrt::playground::implementation
