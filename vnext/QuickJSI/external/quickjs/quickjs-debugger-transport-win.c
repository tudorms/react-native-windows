#include "quickjs-debugger.h"

#if DEBUGGER_ENABLED

#ifdef _WIN32

#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <io.h>
#include <assert.h>

#include <winsock2.h>
#include <ws2tcpip.h>

#if defined(_MSC_VER)
#include <BaseTsd.h>
typedef SSIZE_T ssize_t;
#endif

#if defined(_MSC_VER)
#pragma warning(disable:4996) //Disable _CRT_SECURE_NO_WARNINGS
#endif

struct js_transport_data {
    int handle;
} js_transport_data;

static size_t js_transport_read(void *udata, char *buffer, size_t length) {
    struct js_transport_data* data = (struct js_transport_data *)udata;
    if (data->handle <= 0)
        return -1;

    if (length == 0)
        return -2;

    if (buffer == NULL)
        return -3;

    ssize_t ret = recv( data->handle, (void*)buffer, length, 0);

    if (ret == SOCKET_ERROR)
        return -4;

    if (ret == 0)
        return -5;

    if (ret > length)
        return -6;

    return ret;
}

static size_t js_transport_write(void *udata, const char *buffer, size_t length) {
    struct js_transport_data* data = (struct js_transport_data *)udata;
    if (data->handle <= 0)
        return -1;

    if (length == 0)
        return -2;

    if (buffer == NULL)
        return -3;

    size_t ret = send(data->handle, (const void *) buffer, length, 0);
    if (ret <= 0 || ret > (ssize_t) length)
        return -4;

    return ret;
}

static size_t js_transport_peek(void *udata) {
    WSAPOLLFD  fds[1];
    int poll_rc;

    struct js_transport_data* data = (struct js_transport_data *)udata;
    if (data->handle <= 0)
        return -1;

    fds[0].fd = data->handle;
    fds[0].events = POLLIN;
    fds[0].revents = 0;

    poll_rc = WSAPoll(fds, 1, 0);
    if (poll_rc < 0)
        return -2;
    if (poll_rc > 1)
        return -3;
    // no data
    if (poll_rc == 0)
        return 0;
    // has data
    return 1;
}

static void js_transport_close(JSContext* ctx, void *udata) {
    struct js_transport_data* data = (struct js_transport_data *)udata;
    if (data->handle <= 0)
        return;
    closesocket(data->handle);
    data->handle = 0;
    free(udata);
    WSACleanup();
}

static int js_debugger_parse_address(const char* address, char host_string[], char port_string[], int len) {
    if (address) {
        char* port = strstr(address, ":");
        if (!port)
            return 0;

        strncpy(port_string, port + 1, len);
        strncpy(host_string, address, len);
        host_string[port - address] = 0;

        return 1;
    }
    
    return 0;
}

void js_debugger_connect(JSContext *ctx, const char *address) {
    int result;

    // host and port from address
    char host[16] = { 0 };
    char port[16] = { 0 };
    if (!js_debugger_parse_address(address, host, port, 16)) {
        printf("js_debugger_connect - failed to parse host and port\n");
        return;
    }

    WSADATA wsaData;
    result = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (result != 0) {
        printf("js_debugger_connect - WSAStartup failed with error: %d\n", result);
        return;
    }		
    
    struct addrinfo *addr_info = NULL, *addr_ptr = NULL, hints;
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;

    // server address and port
    result = getaddrinfo(host, port, &hints, &addr_info);
    if (result != 0) {
        printf("js_debugger_connect - getaddrinfo failed with error: %d\n", result);
        WSACleanup();
        return;
    }

    // retry connect to an address until one succeeds
    SOCKET connect_socket = INVALID_SOCKET;
    for (struct addrinfo *addr_ptr = addr_info; addr_ptr != NULL; addr_ptr = addr_ptr->ai_next) {

        // create socket
        connect_socket = socket(addr_ptr->ai_family, addr_ptr->ai_socktype, addr_ptr->ai_protocol);
        if (connect_socket == INVALID_SOCKET) {
            printf("js_debugger_connect -socket failed with error: %ld\n", WSAGetLastError());
            WSACleanup();
            return;
        }

        // try connect to server
        result = connect(connect_socket, addr_ptr->ai_addr, (int)addr_ptr->ai_addrlen);
        if (result == SOCKET_ERROR) {
            closesocket(connect_socket);
            connect_socket = INVALID_SOCKET;
            continue;
        }

        break;
    }

    freeaddrinfo(addr_info);

    if (connect_socket == INVALID_SOCKET) {
        printf("Unable to connect to server!\n");
        WSACleanup();
        return;
    }

    struct js_transport_data *data = (struct js_transport_data *)malloc(sizeof(struct js_transport_data));
    memset(data, 0, sizeof(js_transport_data));
    data->handle = connect_socket;
    js_debugger_attach(ctx, js_transport_read, js_transport_write, js_transport_peek, js_transport_close, data);
}

void js_debugger_wait_connection(JSContext *ctx, const char* address) {
    int result;

    // host and port from address
    char host[16] = { 0 };
    char port[16] = { 0 };
    if (!js_debugger_parse_address(address, host, port, 16)) {
        printf("js_debugger_wait_connection - failed to parse host and port\n");
        return;
    }

    WSADATA wsaData;
    result = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (result != 0) {
        printf("js_debugger_wait_connection - WSAStartup failed with error: %d\n", result);
        return;
    }

    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;
    hints.ai_flags = AI_PASSIVE;

    struct addrinfo *addr_info = NULL;
    result = getaddrinfo(NULL, port, &hints, &addr_info);
    if (result != 0) {
        printf("js_debugger_wait_connection - getaddrinfo failed with error: %d\n", result);
        WSACleanup();
        return;
    }

    // create a SOCKET for connecting to server
    SOCKET listen_socket = socket(addr_info->ai_family, addr_info->ai_socktype, addr_info->ai_protocol);
    if (listen_socket == INVALID_SOCKET) {
        printf("js_debugger_wait_connection - socket failed with error: %ld\n", WSAGetLastError());
        freeaddrinfo(addr_info);
        WSACleanup();
        return;
    }

    // setup the TCP listening socket
    result = bind(listen_socket, addr_info->ai_addr, (int)addr_info->ai_addrlen);
    if (result == SOCKET_ERROR) {
        printf("js_debugger_wait_connection - bind failed with error: %ld\n", WSAGetLastError());
        freeaddrinfo(addr_info);
        closesocket(listen_socket);
        WSACleanup();
        return;
    }

    freeaddrinfo(addr_info);

    result = listen(listen_socket, SOMAXCONN);
    if (result == SOCKET_ERROR) {
        printf("js_debugger_wait_connection - listen failed with error: %ld\n", WSAGetLastError());
        closesocket(listen_socket);
        WSACleanup();
        return;
    }

    // accept a client socket
    SOCKET client_socket = accept(listen_socket, NULL, NULL);
    if (client_socket == INVALID_SOCKET) {
        printf("js_debugger_wait_connection - accept failed with error: %ld\n", WSAGetLastError());
        closesocket(listen_socket);
        WSACleanup();
        return;
    }

    closesocket(listen_socket);

    struct js_transport_data *data = (struct js_transport_data *)malloc(sizeof(struct js_transport_data));
    memset(data, 0, sizeof(js_transport_data));
    data->handle = client_socket;
    js_debugger_attach(ctx, js_transport_read, js_transport_write, js_transport_peek, js_transport_close, data);
}

#endif
#endif