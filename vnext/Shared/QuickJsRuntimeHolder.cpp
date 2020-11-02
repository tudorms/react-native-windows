// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

#include "pch.h"

#include <QuickJSRuntime.h>
#include <mutex>
#include "QuickJSRuntimeHolder.h"

using namespace facebook;

namespace facebook {
namespace react {

std::shared_ptr<jsi::Runtime> QuickJSRuntimeHolder::getRuntime() noexcept {
  std::call_once(once_flag_, [this]() { initRuntime(); });

  if (!runtime_)
    std::terminate();

  // ChakraJsiRuntime is not thread safe as of now.
  if (own_thread_id_ != std::this_thread::get_id())
    std::terminate();

  return runtime_;
}

void QuickJSRuntimeHolder::initRuntime() noexcept {
  quickjs::QuickJSRuntimeArgs args;
  runtime_ = quickjs::makeQuickJSRuntime(std::move(args));
  own_thread_id_ = std::this_thread::get_id();
}

} // namespace react
} // namespace facebook