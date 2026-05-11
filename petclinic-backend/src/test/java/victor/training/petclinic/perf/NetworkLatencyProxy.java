package victor.training.petclinic.perf;

import lombok.RequiredArgsConstructor;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.util.concurrent.TimeUnit;

/**
 * Forwards bytes between a TCP client and a remote server, sleeping {@code delayMillis}
 * after each write to emulate network latency. Adapted from
 * victor.training.performance.helper.NetworkLatencyProxy in the performance-profiling repo.
 */
public class NetworkLatencyProxy {
  private final String remoteHost;
  private final int remotePort;
  private final int port;
  private final int delayMillis;
  private volatile ServerSocket serverSocket;

  public NetworkLatencyProxy(String remoteHost, int remotePort, int port, int delayMillis) {
    this.remoteHost = remoteHost;
    this.remotePort = remotePort;
    this.port = port;
    this.delayMillis = delayMillis;
  }

  public static void main(String[] args) {
    var remoteHost = System.getProperty("remoteHost");
    var remotePort = Integer.parseInt(System.getProperty("remotePort"));
    var port = Integer.parseInt(System.getProperty("port"));
    var delayMillis = Integer.parseInt(System.getProperty("delayMillis"));
    new NetworkLatencyProxy(remoteHost, remotePort, port, delayMillis).run();
  }

  /** Binds the listening port synchronously, then accepts connections on a background daemon thread. */
  public void start() throws IOException {
    this.serverSocket = new ServerSocket(port);
    System.out.println("Proxying port " + port + " with delay " + delayMillis + "ms to remote " + remoteHost + ":" + remotePort);
    Thread acceptor = new Thread(this::acceptLoop, "latency-proxy-acceptor");
    acceptor.setDaemon(true);
    acceptor.start();
  }

  public void run() {
    try {
      start();
      Thread.currentThread().join();
    } catch (IOException | InterruptedException e) {
      throw new RuntimeException(e);
    }
  }

  private void acceptLoop() {
    try {
      while (!serverSocket.isClosed()) {
        Socket socket = serverSocket.accept();
        Thread t = new Thread(new ProxyConnection(socket), "latency-proxy-conn");
        t.setDaemon(true);
        t.start();
      }
    } catch (SocketException ignored) {
      // server socket closed → graceful shutdown
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  public void stop() throws IOException {
    if (serverSocket != null && !serverSocket.isClosed()) {
      serverSocket.close();
    }
  }

  @RequiredArgsConstructor
  private class ProxyConnection implements Runnable {
    private final Socket clientsocket;
    private Socket serverConnection;

    @Override
    public void run() {
      try {
        serverConnection = new Socket(remoteHost, remotePort);
      } catch (IOException e) {
        e.printStackTrace();
        return;
      }
      Thread t1 = new Thread(new CopyDataTask(clientsocket, serverConnection), "proxy-c2s");
      Thread t2 = new Thread(new CopyDataTask(serverConnection, clientsocket), "proxy-s2c");
      t1.setDaemon(true);
      t2.setDaemon(true);
      t1.start();
      t2.start();
    }
  }

  @RequiredArgsConstructor
  private class CopyDataTask implements Runnable {
    private final Socket in;
    private final Socket out;

    @Override
    public void run() {
      try {
        InputStream inputStream = in.getInputStream();
        OutputStream outputStream = out.getOutputStream();
        byte[] buf = new byte[40960];
        int bytesRead;
        while (-1 != (bytesRead = inputStream.read(buf))) {
          outputStream.write(buf, 0, bytesRead);
          TimeUnit.MILLISECONDS.sleep(delayMillis);
        }
      } catch (SocketException ignored) {
      } catch (Exception e) {
        e.printStackTrace();
      } finally {
        try {
          in.close();
        } catch (IOException ignored) {
        }
      }
    }
  }
}
