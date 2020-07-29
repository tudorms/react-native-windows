// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

#pragma once
#include <JSI/Shared/RuntimeHolder.h>

#include <jsi/jsi.h>
#include <thread>

namespace facebook {
namespace react {

class QuickJSRuntimeHolder : public facebook::jsi::RuntimeHolderLazyInit {
 public:
  std::shared_ptr<facebook::jsi::Runtime> getRuntime() noexcept override;

 private:
  void initRuntime() noexcept;
  std::shared_ptr<facebook::jsi::Runtime> runtime_;

  std::once_flag once_flag_;
  std::thread::id own_thread_id_;
};

} // namespace react
} // namespace facebook
