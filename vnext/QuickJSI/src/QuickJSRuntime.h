#pragma once
#include <jsi/jsi.h>

#ifdef CREATE_SHARED_LIBRARY
#define QUICKJSI_EXPORT __declspec(dllexport)
#else
#define QUICKJSI_EXPORT
#endif // CREATE_SHARED_LIBRARY

namespace quickjs {

struct QuickJSRuntimeArgs
{
	bool enableTracing { false };
};

QUICKJSI_EXPORT std::unique_ptr<facebook::jsi::Runtime> __cdecl makeQuickJSRuntime(QuickJSRuntimeArgs &&args);

}
