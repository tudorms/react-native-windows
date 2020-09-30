// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

#include "pch.h"

#include <hermes/hermes.h>
#include <mutex>
#include "HermesRuntimeHolder.h"

#include <jsi/decorator.h>
#include <cxxreact/MessageQueueThread.h>

#ifdef HERMES_ENABLE_DEBUGGER
#include <hermes/inspector/RuntimeAdapter.h>
#include <hermes/inspector/chrome/Registration.h>
#endif

using namespace facebook;

namespace facebook {
namespace react {

std::shared_ptr<jsi::Runtime> HermesRuntimeHolder::getRuntime() noexcept {
  std::call_once(once_flag_, [this]() { initRuntime(); });

  if (!runtime_)
    std::terminate();

  // ChakraJsiRuntime is not thread safe as of now.
  if (own_thread_id_ != std::this_thread::get_id())
    std::terminate();

  return runtime_;
}

void HermesRuntimeHolder::initRuntime() noexcept {
  runtime_ = facebook::hermes::makeHermesRuntime();
  own_thread_id_ = std::this_thread::get_id();
}


#ifdef HERMES_ENABLE_DEBUGGER

class HermesExecutorRuntimeAdapter : public facebook::hermes::inspector::RuntimeAdapter {
 public:
  HermesExecutorRuntimeAdapter(
      std::shared_ptr<jsi::Runtime> runtime,
      facebook::hermes::HermesRuntime &hermesRuntime,
      std::shared_ptr<MessageQueueThread> thread)
      : runtime_(runtime), hermesRuntime_(hermesRuntime), thread_(std::move(thread)) {}

  virtual ~HermesExecutorRuntimeAdapter() = default;

  jsi::Runtime &getRuntime() override {
    return *runtime_;
  }

  facebook::hermes::debugger::Debugger &getDebugger() override {
    return hermesRuntime_.getDebugger();
  }

  void tickleJs() override {
    // The queue will ensure that runtime_ is still valid when this
    // gets invoked.
    thread_->runOnQueue([&runtime = runtime_]() {
      auto func = runtime->global().getPropertyAsFunction(*runtime, "__tickleJs");
      func.call(*runtime);
    });
  }

 private:
  std::shared_ptr<jsi::Runtime> runtime_;
  facebook::hermes::HermesRuntime &hermesRuntime_;

  std::shared_ptr<MessageQueueThread> thread_;
};

#endif

// TODO: reconcile with code in \ReactCommon\hermes\executor\HermesExecutorFactory.cpp when we catch up to FB master
class DecoratedRuntime : public jsi::RuntimeDecorator<> {
 public:
  DecoratedRuntime(
      std::unique_ptr<jsi::Runtime> runtime,
      hermes::HermesRuntime &hermesRuntime,
      std::shared_ptr<MessageQueueThread> jsQueue)
      : jsi::RuntimeDecorator<>(*runtime),
        runtime_(std::move(runtime)),
        hermesRuntime_(hermesRuntime) {
#ifdef HERMES_ENABLE_DEBUGGER
    auto adapter = std::make_unique<HermesExecutorRuntimeAdapter>(runtime_, hermesRuntime_, jsQueue);
    facebook::hermes::inspector::chrome::enableDebugging(std::move(adapter), "Hermes React Native");
#else
    (void)hermesRuntime_;
#endif
  }

  ~DecoratedRuntime() {
#ifdef HERMES_ENABLE_DEBUGGER
    facebook::hermes::inspector::chrome::disableDebugging(hermesRuntime_);
#endif
  }

 private:
  std::shared_ptr<Runtime> runtime_;
  hermes::HermesRuntime &hermesRuntime_;
};

std::shared_ptr<jsi::Runtime> DebugHermesRuntimeHolder::getRuntime() noexcept {
  std::call_once(once_flag_, [this]() { initRuntime(); });

  if (!runtime_)
    std::terminate();

  // the runtime is not thread safe as of now.
  if (own_thread_id_ != std::this_thread::get_id())
    std::terminate();

  return runtime_;
}

void DebugHermesRuntimeHolder::initRuntime() noexcept {
  std::unique_ptr<facebook::hermes::HermesRuntime> hermesRuntime = facebook::hermes::makeHermesRuntime();
  facebook::hermes::HermesRuntime &hermesRuntimeRef = *hermesRuntime;

  runtime_ = std::make_shared<DecoratedRuntime>(std::move(hermesRuntime), hermesRuntimeRef, jsQueue_);
  own_thread_id_ = std::this_thread::get_id();
}

} // namespace react
} // namespace facebook
